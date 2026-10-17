"use client";

import { Copy, Plus, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/common";
import { Field } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, applyFieldErrors } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { type InviteCode, useFinanceMutation, useInviteCodes } from "@/lib/queries";
import { useSession } from "@/lib/session";

const STATUS: Record<InviteCode["status"], { label: string; variant: "outline" | "secondary" | "destructive" }> = {
  active: { label: "Active", variant: "outline" },
  used_up: { label: "Used up", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
  disabled: { label: "Switched off", variant: "secondary" },
};

type Values = { code: string; note: string; max_uses: string; expires_on: string };

function NewCodeForm({ onDone }: { onDone: (code: InviteCode) => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ defaultValues: { code: "", note: "", max_uses: "1", expires_on: "" } });
  const save = useFinanceMutation(
    (v: Values) =>
      api.post<InviteCode>("/admin/invite-codes", {
        code: v.code.trim(),
        note: v.note.trim(),
        max_uses: v.max_uses.trim() ? Number(v.max_uses) : null,
        // End of the chosen day in the viewer's time zone.
        expires_at: v.expires_on ? new Date(`${v.expires_on}T23:59:59`).toISOString() : null,
      }),
    { silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (v.code.trim() && !/^[A-Za-z0-9-]{6,40}$/.test(v.code.trim())) return form.setError("code", { message: "6 to 40 letters, digits or dashes" });
        if (v.max_uses.trim() && !(/^\d+$/.test(v.max_uses.trim()) && Number(v.max_uses) >= 1 && Number(v.max_uses) <= 10000))
          return form.setError("max_uses", { message: "A whole number from 1 to 10,000, or empty for no limit" });
        setError(null);
        try {
          onDone(await save.mutateAsync(v));
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["code", "note", "max_uses"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" error={e.code?.message} hint="Leave empty to generate a random code.">
          {({ id, invalid, describedBy }) => <Input id={id} autoComplete="off" aria-invalid={invalid} aria-describedby={describedBy} placeholder="e.g. FAMILY-2026" {...form.register("code")} />}
        </Field>
        <Field label="Who is it for?" hint="Optional note, only staff see it.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} maxLength={200} {...form.register("note")} />}
        </Field>
        <Field label="Number of sign-ups" error={e.max_uses?.message} hint="Empty = no limit.">
          {({ id, invalid, describedBy }) => <Input id={id} inputMode="numeric" aria-invalid={invalid} aria-describedby={describedBy} {...form.register("max_uses")} />}
        </Field>
        <Field label="Expires after" hint="Optional. The code works until the end of this day.">
          {({ id, describedBy }) => <Input id={id} type="date" aria-describedby={describedBy} {...form.register("expires_on")} />}
        </Field>
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Creating…" : "Create code"}</Button>
      </div>
    </form>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy. Select the code and copy it by hand.");
  }
}

function Row({ c }: { c: InviteCode }) {
  const [confirm, setConfirm] = useState(false);
  const toggle = useFinanceMutation((v: boolean) => api.patch(`/admin/invite-codes/${c.id}`, { is_active: v }), { success: "Saved" });
  const del = useFinanceMutation(() => api.delete(`/admin/invite-codes/${c.id}`), { success: "Code deleted" });
  const s = STATUS[c.status];
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{c.code}</code>
          <Button variant="ghost" size="icon-sm" aria-label={`Copy ${c.code}`} onClick={() => copy(c.code)}><Copy /></Button>
        </div>
        {c.note && <span className="block max-w-56 truncate text-xs text-muted-foreground">{c.note}</span>}
      </TableCell>
      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
      <TableCell className="num whitespace-nowrap">{c.uses} / {c.max_uses ?? "∞"}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{c.expires_at ? formatDate(c.expires_at.slice(0, 10)) : "Never"}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(c.created_at.slice(0, 10))}{c.created_by && ` · ${c.created_by}`}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Switch checked={c.is_active} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label={c.is_active ? `Switch off ${c.code}` : `Switch on ${c.code}`} />
          {c.uses === 0 && (
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.code}`} onClick={() => setConfirm(true)}><Trash2 /></Button>
          )}
        </div>
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Delete ${c.code}?`} description="Nobody has used this code yet, so it can be deleted." onConfirm={() => del.mutateAsync(undefined)} />
      </TableCell>
    </TableRow>
  );
}

export default function InviteCodesPage() {
  const { user } = useSession();
  const codes = useInviteCodes();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<InviteCode | null>(null);
  // The server answers 404 to anyone who isn't staff; this only avoids showing them an empty page.
  if (!user?.is_staff || (codes.error instanceof ApiError && codes.error.status === 404)) {
    return <EmptyState title="Page not found" description="This page is only for the site's administrators." />;
  }
  return (
    <>
      <PageHeader
        title="Invite codes"
        description="Codes let people create an account with a username and password. Google sign-up doesn't need one. Once any code exists, password sign-up stays invite-only."
        actions={<Button onClick={() => setCreating(true)}><Plus /> New code</Button>}
      />
      {codes.error && !codes.data ? (
        <ErrorState error={codes.error} onRetry={() => codes.refetch()} />
      ) : codes.isPending ? (
        <LoadingRows rows={3} />
      ) : codes.data.length === 0 ? (
        <EmptyState icon={Ticket} title="No invite codes yet" description="Create a code and share it with someone you want to invite." action={<Button onClick={() => setCreating(true)}><Plus /> New code</Button>} />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.data.map((c) => <Row key={c.id} c={c} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="New invite code">
        <NewCodeForm
          onDone={(c) => {
            setCreating(false);
            setCreated(c);
          }}
        />
      </FormDialog>
      <FormDialog open={!!created} onOpenChange={(o) => !o && setCreated(null)} title="Invite code created">
        {created && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">Share this code. It&apos;s entered on the Create an account page; capital letters don&apos;t matter.</p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <code className="flex-1 font-mono text-lg font-semibold tracking-wide">{created.code}</code>
              <Button variant="outline" size="sm" onClick={() => copy(created.code)}><Copy /> Copy</Button>
            </div>
            <div className="flex justify-end"><Button onClick={() => setCreated(null)}>Done</Button></div>
          </div>
        )}
      </FormDialog>
    </>
  );
}
