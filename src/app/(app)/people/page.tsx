"use client";

import { MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/common";
import { Field, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { isZero } from "@/lib/money";
import { type Person, useFinanceMutation, usePeople } from "@/lib/queries";

const REL = [
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "bank", label: "Bank / institution" },
  { value: "other", label: "Other" },
] as const;

function PersonForm({ initial, onDone }: { initial?: Person; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { name: initial?.name ?? "", relationship: initial?.relationship ?? "other", phone: initial?.phone ?? "", email: initial?.email ?? "", notes: initial?.notes ?? "" } });
  const save = useFinanceMutation((v: Record<string, string>) => (initial ? api.patch(`/people/${initial.id}`, v) : api.post("/people", v)), { success: initial ? "Saved" : "Person added", silentError: true });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!v.name.trim()) return form.setError("name", { message: "Enter a name" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "phone", "email"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={form.formState.errors.name?.message}>{({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} {...form.register("name")} />}</Field>
        <Field label="Relationship">{({ id }) => <Controller control={form.control} name="relationship" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={REL} />} />}</Field>
        <Field label="Phone" error={form.formState.errors.phone?.message}>{({ id }) => <Input id={id} type="tel" {...form.register("phone")} />}</Field>
        <Field label="Email" error={form.formState.errors.email?.message}>{({ id }) => <Input id={id} type="email" {...form.register("email")} />}</Field>
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save" : "Add person"}</Button></div>
    </form>
  );
}

function Actions({ p, onEdit }: { p: Person; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/people/${p.id}`), { success: "Person removed" });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Remove ${p.name}?`} description="People with loans or held money can't be removed." onConfirm={() => del.mutateAsync(undefined)} />
    </>
  );
}

export default function PeoplePage() {
  const q = usePeople();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  return (
    <>
      <PageHeader title="People" description="Lenders, borrowers and anyone whose money you hold — with what's outstanding." actions={<Button onClick={() => setCreating(true)}><Plus /> Add person</Button>} />
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <LoadingRows rows={4} />
      ) : !q.data.length ? (
        <EmptyState icon={Users} title="No people yet" description="People are added automatically when you record a loan or money held for someone." />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="text-right">Owes you</TableHead>
                  <TableHead className="text-right">You owe</TableHead>
                  <TableHead className="text-right">You hold for them</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{REL.find((r) => r.value === p.relationship)?.label}{p.phone && ` · ${p.phone}`}</p>
                    </TableCell>
                    <TableCell className="text-right">{isZero(p.lent_outstanding) ? <span className="text-muted-foreground">—</span> : <Link href="/lent/" className="hover:underline"><Money value={p.lent_outstanding} /></Link>}</TableCell>
                    <TableCell className="text-right">{isZero(p.borrowed_outstanding) ? <span className="text-muted-foreground">—</span> : <Link href="/loans/" className="hover:underline"><Money value={p.borrowed_outstanding} /></Link>}</TableCell>
                    <TableCell className="text-right">{isZero(p.held_for) ? <span className="text-muted-foreground">—</span> : <Link href="/custody/" className="hover:underline"><Money value={p.held_for} /></Link>}</TableCell>
                    <TableCell><Actions p={p} onEdit={() => setEditing(p)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="Add person"><PersonForm onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit person">{editing && <PersonForm initial={editing} onDone={() => setEditing(null)} />}</FormDialog>
    </>
  );
}
