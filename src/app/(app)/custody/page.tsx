"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, ChevronRight, Plus, Vault } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingRows, Money, PageHeader, StatCard } from "@/components/common";
import { AccountSelect, AmountInput, Field, PersonInput } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { addMoney, isValidAmount, normalizeAmount } from "@/lib/money";
import { type Custody, type CustodyDetail, useCustodyList, useFinanceMutation } from "@/lib/queries";

const schema = z.object({
  counterparty_name: z.string().trim().min(1, "Whose money is it?").max(150),
  purpose: z.string().trim().min(1, "Add a short purpose").max(150),
  amount: z.string().refine(isValidAmount, "Enter the amount received"),
  date: z.string().min(1, "Choose a date"),
  account_id: z.string(),
  expected_return_date: z.string(),
  notes: z.string().max(5000),
});
type Values = z.infer<typeof schema>;

function CustodyForm({ onDone }: { onDone: (c: CustodyDetail) => void }) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { counterparty_name: "", purpose: "", amount: "", date: today(), account_id: "", expected_return_date: "", notes: "" },
  });
  const save = useFinanceMutation(
    (v: Values) =>
      api.post<CustodyDetail>(
        "/custody",
        {
          counterparty_name: v.counterparty_name.trim(),
          purpose: v.purpose.trim(),
          amount: normalizeAmount(v.amount),
          date: v.date,
          account_id: v.account_id ? Number(v.account_id) : null,
          expected_return_date: v.expected_return_date || null,
          notes: v.notes,
        },
        key,
      ),
    { success: "Recorded money held for someone else", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        try {
          onDone(await save.mutateAsync(v));
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, Object.keys(v)));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner of the money" required error={e.counterparty_name?.message}>
          {({ id, invalid }) => (
            <Controller control={form.control} name="counterparty_name" render={({ field }) => <PersonInput id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder="e.g. Father" />} />
          )}
        </Field>
        <Field label="Purpose" required error={e.purpose?.message}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} placeholder="e.g. For house repairs" {...form.register("purpose")} />}
        </Field>
        <Field label="Amount received" required error={e.amount?.message}>
          {({ id, invalid }) => <AmountInput id={id} aria-invalid={invalid} {...form.register("amount")} />}
        </Field>
        <Field label="Date received">{({ id }) => <Input id={id} type="date" {...form.register("date")} />}</Field>
        <Field label="Held in account" hint="Where the money physically sits.">
          {({ id, describedBy }) => (
            <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} describedBy={describedBy} noneLabel="Not in a tracked account" />} />
          )}
        </Field>
        <Field label="Expected return date">{({ id }) => <Input id={id} type="date" {...form.register("expected_return_date")} />}</Field>
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">This money is not counted as your income or your available money. It stays visible as “held for others” until you return it.</p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Record"}</Button>
      </div>
    </form>
  );
}

function CustodyCard({ c }: { c: Custody }) {
  return (
    <Link href={`/custody/view/?id=${c.id}`} className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className={`transition-colors group-hover:border-primary/40 ${c.is_settled ? "opacity-70" : ""}`}>
        <CardContent className="grid gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.counterparty.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.purpose}</p>
            </div>
            {c.is_settled ? (
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Returned</Badge>
            ) : c.overdue ? (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Past return date</Badge>
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-xl font-semibold tracking-tight"><Money value={c.held} /></p>
          <p className="text-xs text-muted-foreground">
            Received <Money value={c.received} /> · returned <Money value={c.returned} />
            {c.expected_return_date && !c.is_settled && ` · return by ${formatDate(c.expected_return_date)}`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CustodyPage() {
  const list = useCustodyList();
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const open = list.data?.filter((c) => !c.is_settled) ?? [];
  const settled = list.data?.filter((c) => c.is_settled) ?? [];
  const held = addMoney(...open.map((c) => c.held));
  const owners = new Set(open.map((c) => c.counterparty.id)).size;

  return (
    <>
      <PageHeader
        title="Money held for others"
        description="Money belonging to parents, friends or relatives that you are keeping temporarily."
        actions={<Button onClick={() => setCreating(true)}><Plus /> Record money received</Button>}
      />
      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="Currently holding" value={held} hint={`for ${owners} ${owners === 1 ? "person" : "people"} · not counted as your money`} />
            <StatCard label="Returned so far" value={addMoney(...(list.data ?? []).map((c) => c.returned))} hint="Across all records" />
          </div>
          {!list.data?.length ? (
            <EmptyState icon={Vault} title="Not holding anyone's money" description="When someone gives you money to keep, record it here so it isn't mistaken for your own." action={<Button onClick={() => setCreating(true)}><Plus /> Record money received</Button>} />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{open.map((c) => <CustodyCard key={c.id} c={c} />)}</div>
              {settled.length > 0 && (
                <div>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">Fully returned</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{settled.map((c) => <CustodyCard key={c.id} c={c} />)}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="Record money held for someone" wide>
        <CustodyForm onDone={(c) => { setCreating(false); router.push(`/custody/view/?id=${c.id}`); }} />
      </FormDialog>
    </>
  );
}
