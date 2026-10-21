"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Lock, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, request, type Schemas } from "@/lib/api";
import { decryptBackup, encryptBackup, isEncryptedBackup, passwordProblem, type EncryptedEnvelope } from "@/lib/backup-crypto";

type Result = Schemas["TransferImportOut"];
type Picked = { name: string; payload?: unknown; envelope?: EncryptedEnvelope };

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

/** Saves a file in the browser (no server round trip). */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = passwordProblem(password, confirm);
  return (
    <form
      className="grid max-w-md gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        if (problem) return;
        setBusy(true);
        setError(null);
        try {
          const file = await request<Record<string, unknown>>("POST", "/transfer/export", { body: {} });
          const envelope = await encryptBackup(JSON.stringify(file), password);
          download(`FinanceAyudhas_Backup_${new Date().toISOString().slice(0, 10)}_Encrypted.json`, JSON.stringify(envelope));
          const records = (file.metadata as { totalRecords?: number } | undefined)?.totalRecords ?? 0;
          toast.success(`Backup downloaded: ${records.toLocaleString("en-IN")} records, protected with your password`);
          setPassword("");
          setConfirm("");
          setTouched(false);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Backup password" hint="At least 8 characters. It isn't stored anywhere: if you forget it, the backup can't be opened.">
        {({ id, describedBy }) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="Repeat the password" error={touched && problem ? problem : undefined}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} aria-describedby={describedBy} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={busy}>
          <Download /> {busy ? "Encrypting…" : "Download encrypted backup"}
        </Button>
      </div>
    </form>
  );
}

function ImportForm() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<Result | null>(null);
  const [busy, setBusy] = useState<null | "open" | "import">(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPicked(null);
    setPassword("");
    setPreview(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const dryRun = async (payload: unknown, name: string) => {
    const result = await request<Result>("POST", "/transfer/import", { body: payload, query: { dry_run: true } });
    setPicked({ name, payload });
    setPreview(result);
  };

  const choose = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setBusy("open");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("This file isn't a backup (it isn't valid JSON).");
      }
      if (isEncryptedBackup(parsed)) setPicked({ name: file.name, envelope: parsed });
      else await dryRun(parsed, file.name);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const unlock = async () => {
    if (!picked?.envelope) return;
    setBusy("open");
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await decryptBackup(picked.envelope, password));
      } catch (err) {
        if (err instanceof SyntaxError) throw new Error("The decrypted backup isn't valid. The file may be damaged.");
        throw err;
      }
      await dryRun(parsed, picked.name);
      setPassword("");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async () => {
    if (!picked?.payload) return;
    setBusy("import");
    setError(null);
    try {
      const result = await request<Result>("POST", "/transfer/import", { body: picked.payload });
      await qc.invalidateQueries();
      toast.success(result.added ? `Imported ${result.added.toLocaleString("en-IN")} records` : "Nothing new to import");
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}` : message(err));
    } finally {
      setBusy(null);
    }
  };

  const rows = preview ? Object.entries(preview.tables).filter(([, t]) => t.incoming) : [];
  return (
    <div className="grid gap-4">
      <div className="grid max-w-md gap-1.5">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          id="backup-file"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <div>
          <Button type="button" variant="outline" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            <FileUp /> {busy === "open" && !picked ? "Reading…" : "Choose backup file"}
          </Button>
        </div>
        {picked && <p className="truncate text-sm text-muted-foreground">{picked.name}</p>}
      </div>

      {picked?.envelope && !preview && (
        <form
          className="grid max-w-md gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <Field label="Password of this backup" hint="The password used when the backup was made, on this website or in the Ayudhas Pro app.">
            {({ id, describedBy }) => <Input id={id} type="password" autoComplete="off" autoFocus aria-describedby={describedBy} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={!password || !!busy}>
              <Lock /> {busy === "open" ? "Unlocking…" : "Unlock"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {preview && (
        <div className="grid gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Already here</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([key, t]) => (
                <TableRow key={key}>
                  <TableCell>{t.label}</TableCell>
                  <TableCell className="num text-right font-medium">{t.added}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{t.matched}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{t.skipped}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview.notes.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
          <p className="text-sm">
            {preview.added
              ? `${preview.added.toLocaleString("en-IN")} new records will be added. Records already here are kept as they are; nothing is deleted or overwritten.`
              : "Everything in this file is already here."}
          </p>
          <div className="flex gap-2">
            <Button onClick={confirmImport} disabled={!preview.added || !!busy}>
              <Upload /> {busy === "import" ? "Importing…" : `Import ${preview.added.toLocaleString("en-IN")} records`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy === "import"}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

/** Settings › Backup & transfer: move finance data between this website and the Ayudhas Pro app, both ways. */
export function BackupTransferCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup & transfer</CardTitle>
        <CardDescription>
          Download all your finance records as a password-protected file, or import one made here or in the Ayudhas Pro app (Backup &amp; Restore › Finance only). The file is
          encrypted in your browser with AES-256; your password never leaves this device. Importing adds only what isn&apos;t here yet, so moving data back and forth never
          creates duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <section className="grid gap-3" aria-labelledby="backup-export">
          <h3 id="backup-export" className="text-sm font-semibold">
            Download a backup
          </h3>
          <ExportForm />
        </section>
        <section className="grid gap-3" aria-labelledby="backup-import">
          <h3 id="backup-import" className="text-sm font-semibold">
            Import a backup
          </h3>
          <ImportForm />
        </section>
      </CardContent>
    </Card>
  );
}
