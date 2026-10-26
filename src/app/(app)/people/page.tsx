"use client";

import { ListOrdered, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/common";
import { Field, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TransactionsList } from "@/components/transactions-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { isZero } from "@/lib/money";
import { type Person, type PersonGroup, useFinanceMutation, usePeople, usePersonGroups, useTransactions } from "@/lib/queries";

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

/** "+₹2,000" / "−₹1,300": received from them minus spent for them. */
function ForThem({ value }: { value: string }) {
  return isZero(value) ? <span className="text-muted-foreground">—</span> : <Money value={value} sign tone="auto" />;
}

/** A person's or group's transactions, in a dialog. */
type ListTarget = { title: string; counterparty_id?: number; person_group_id?: number };

function TransactionsOf({ target }: { target: ListTarget }) {
  const q = useTransactions({ counterparty_id: target.counterparty_id, person_group_id: target.person_group_id, page_size: 100 });
  if (q.isPending) return <LoadingRows rows={3} />;
  return <TransactionsList items={q.data?.items ?? []} compact emptyTitle="No transactions yet" emptyDescription="Link income or expenses with “For person” or “From person” in the transaction form." />;
}

function TransactionsDialog({ target, onClose }: { target: ListTarget | null; onClose: () => void }) {
  return (
    <FormDialog open={!!target} onOpenChange={(o) => !o && onClose()} title={target ? `${target.title}: transactions` : ""} wide>
      {target && <TransactionsOf target={target} />}
    </FormDialog>
  );
}

function GroupForm({ initial, onDone }: { initial?: PersonGroup; onDone: () => void }) {
  const people = usePeople();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { name: initial?.name ?? "", notes: initial?.notes ?? "", member_ids: initial?.members.map((m) => m.id) ?? ([] as number[]) } });
  const save = useFinanceMutation(
    (v: { name: string; notes: string; member_ids: number[] }) => (initial ? api.patch(`/people/groups/${initial.id}`, v) : api.post("/people/groups", v)),
    { success: initial ? "Saved" : "Group added", silentError: true },
  );
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
          setError(applyFieldErrors(err, form.setError as never, ["name"]));
        }
      })}
    >
      <Field label="Name" required error={form.formState.errors.name?.message}>
        {({ id, invalid }) => <Input id={id} autoFocus placeholder="e.g. Family" aria-invalid={invalid} {...form.register("name")} />}
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">People in this group</legend>
        <p className="text-xs text-muted-foreground">A person can be in several groups.</p>
        <Controller
          control={form.control}
          name="member_ids"
          render={({ field }) =>
            !people.data?.length ? (
              <p className="text-sm text-muted-foreground">Add people first.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {people.data.map((p) => {
                  const on = field.value.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Checkbox checked={on} onCheckedChange={(c) => field.onChange(c ? [...field.value, p.id] : field.value.filter((x) => x !== p.id))} />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            )
          }
        />
      </fieldset>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save" : "Add group"}</Button></div>
    </form>
  );
}

function GroupActions({ g, onEdit, onList }: { g: PersonGroup; onEdit: () => void; onList: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/people/groups/${g.id}`), { success: "Group removed" });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onList}><ListOrdered /> Transactions</DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Remove the group ${g.name}?`} description="Only the group goes: its people and their transactions stay." onConfirm={() => del.mutateAsync(undefined)} />
    </>
  );
}

function GroupsCard({ onList }: { onList: (t: { title: string; person_group_id: number }) => void }) {
  const q = usePersonGroups();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PersonGroup | null>(null);
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Groups</CardTitle>
          <CardDescription>Put people together (e.g. Family: brother and dad) to see one balance: what they gave minus what you spent for them.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}><Plus /> Add group</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        {q.isPending ? (
          <div className="px-6"><LoadingRows rows={2} /></div>
        ) : !q.data?.length ? (
          <p className="px-6 pb-2 text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Group</TableHead>
                <TableHead className="text-right">Spent for them</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.members.length ? g.members.map((m) => m.name).join(", ") : "No members yet"}</p>
                  </TableCell>
                  <TableCell className="text-right"><Money value={g.spent_for} /></TableCell>
                  <TableCell className="text-right"><Money value={g.received_from} tone="in" /></TableCell>
                  <TableCell className="text-right"><ForThem value={g.for_them_balance} /></TableCell>
                  <TableCell><GroupActions g={g} onEdit={() => setEditing(g)} onList={() => onList({ title: g.name, person_group_id: g.id })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <FormDialog open={creating} onOpenChange={setCreating} title="Add group"><GroupForm onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit group">{editing && <GroupForm initial={editing} onDone={() => setEditing(null)} />}</FormDialog>
    </Card>
  );
}

function Actions({ p, onEdit, onList }: { p: Person; onEdit: () => void; onList: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/people/${p.id}`), { success: "Person removed" });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onList}><ListOrdered /> Transactions</DropdownMenuItem>
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
  const [listing, setListing] = useState<ListTarget | null>(null);
  return (
    <>
      <PageHeader title="People" description="Who you spend for or get money from, lenders, borrowers and anyone whose money you hold." actions={<Button onClick={() => setCreating(true)}><Plus /> Add person</Button>} />
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <LoadingRows rows={4} />
      ) : !q.data.length ? (
        <EmptyState icon={Users} title="No people yet" description="Add the people you spend for or get money from, then pick them in a transaction's “For person”. People are also added when you record a loan or money held for someone." />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="text-right">Spent for them</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
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
                    <TableCell className="text-right">{isZero(p.spent_for) ? <span className="text-muted-foreground">—</span> : <Money value={p.spent_for} />}</TableCell>
                    <TableCell className="text-right">{isZero(p.received_from) ? <span className="text-muted-foreground">—</span> : <Money value={p.received_from} tone="in" />}</TableCell>
                    <TableCell className="text-right"><ForThem value={p.for_them_balance} /></TableCell>
                    <TableCell className="text-right">{isZero(p.lent_outstanding) ? <span className="text-muted-foreground">—</span> : <Link href="/lent/" className="hover:underline"><Money value={p.lent_outstanding} /></Link>}</TableCell>
                    <TableCell className="text-right">{isZero(p.borrowed_outstanding) ? <span className="text-muted-foreground">—</span> : <Link href="/loans/" className="hover:underline"><Money value={p.borrowed_outstanding} /></Link>}</TableCell>
                    <TableCell className="text-right">{isZero(p.held_for) ? <span className="text-muted-foreground">—</span> : <Link href="/custody/" className="hover:underline"><Money value={p.held_for} /></Link>}</TableCell>
                    <TableCell><Actions p={p} onEdit={() => setEditing(p)} onList={() => setListing({ title: p.name, counterparty_id: p.id })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <GroupsCard onList={setListing} />
      <TransactionsDialog target={listing} onClose={() => setListing(null)} />
      <FormDialog open={creating} onOpenChange={setCreating} title="Add person"><PersonForm onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit person">{editing && <PersonForm initial={editing} onDone={() => setEditing(null)} />}</FormDialog>
    </>
  );
}
