"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Check, MoreHorizontal, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/common";
import { AccountSelect, AmountInput, CategorySelect, Field, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, applyFieldErrors } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { isValidAmount, normalizeAmount } from "@/lib/money";
import { type Recurring, useFinanceMutation, useRecurring } from "@/lib/queries";

const FREQ = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

const schema = z
  .object({
    name: z.string().trim().min(1, "Name this rule").max(150),
    kind: z.enum(["income", "expense"]),
    amount: z.string().refine(isValidAmount, "Enter the amount"),
    frequency: z.enum(["monthly", "weekly", "quarterly", "yearly"]),
    start_date: z.string().min(1, "Choose the first date"),
    end_date: z.string(),
    account_id: z.string(),
    category_id: z.string(),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ["end_date"], message: "Must be after the first date" });
type Values = z.infer<typeof schema>;

function RuleForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", kind: "expense", amount: "", frequency: "monthly", start_date: today(), end_date: "", account_id: "", category_id: "" },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const save = useFinanceMutation(
    (v: Values) =>
      api.post("/recurring", {
        name: v.name,
        kind: v.kind,
        amount: normalizeAmount(v.amount),
        frequency: v.frequency,
        start_date: v.start_date,
        end_date: v.end_date || null,
        account_id: v.account_id ? Number(v.account_id) : null,
        category_id: v.category_id ? Number(v.category_id) : null,
        description: v.name,
      }),
    { success: "Recurring rule created", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, Object.keys(v)));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={e.name?.message}>{({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. Salary, Rent, Netflix" {...form.register("name")} />}</Field>
        <Field label="Type">
          {({ id }) => (
            <Controller control={form.control} name="kind" render={({ field }) => (
              <SimpleSelect id={id} value={field.value} onChange={(v) => { field.onChange(v); form.setValue("category_id", ""); }} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
            )} />
          )}
        </Field>
        <Field label="Amount" required error={e.amount?.message}>{({ id, invalid }) => <AmountInput id={id} aria-invalid={invalid} {...form.register("amount")} />}</Field>
        <Field label="Repeats">{({ id }) => <Controller control={form.control} name="frequency" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={FREQ} />} />}</Field>
        <Field label="First occurrence" error={e.start_date?.message}>{({ id }) => <Input id={id} type="date" {...form.register("start_date")} />}</Field>
        <Field label="Ends" error={e.end_date?.message}>{({ id }) => <Input id={id} type="date" {...form.register("end_date")} />}</Field>
        <Field label="Account">{({ id }) => <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} />} />}</Field>
        <Field label="Category">{({ id }) => <Controller control={form.control} name="category_id" render={({ field }) => <CategorySelect id={id} kind={kind} value={field.value} onChange={field.onChange} />} />}</Field>
      </div>
      <p className="text-xs text-muted-foreground">Rules never create transactions on their own. Each due occurrence waits here until you post it, and an occurrence can only be posted once.</p>
      <FormError message={error} />
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Create rule"}</Button></div>
    </form>
  );
}

function RuleCard({ r }: { r: Recurring }) {
  const [confirm, setConfirm] = useState(false);
  const post = useFinanceMutation((date: string) => api.post(`/recurring/${r.id}/post`, { occurrence_date: date }), { success: "Posted to transactions" });
  const toggle = useFinanceMutation(() => api.patch(`/recurring/${r.id}`, { is_active: !r.is_active }), { success: r.is_active ? "Rule paused" : "Rule resumed" });
  const del = useFinanceMutation(() => api.delete(`/recurring/${r.id}`), { success: "Rule deleted" });
  return (
    <Card className={r.is_active ? undefined : "opacity-70"}>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{r.name}</p>
              <Badge variant="secondary">{r.kind === "income" ? "Income" : "Expense"}</Badge>
              {!r.is_active && <Badge variant="outline">Paused</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {FREQ.find((f) => f.value === r.frequency)?.label} from {formatDate(r.start_date)}
              {r.end_date && ` to ${formatDate(r.end_date)}`}
              {r.account && ` · ${r.account.name}`}
              {r.category && ` · ${r.category.name}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => toggle.mutate(undefined)}>{r.is_active ? <Pause /> : <Play />} {r.is_active ? "Pause" : "Resume"}</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xl font-semibold tracking-tight"><Money value={r.amount} /></p>
        {r.pending_dates.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-warning">{r.pending_dates.length} occurrence{r.pending_dates.length === 1 ? "" : "s"} waiting to be posted</p>
            <ul className="grid gap-1">
              {r.pending_dates.slice(-3).map((d) => (
                <li key={d} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                  {formatDate(d)}
                  <Button size="xs" variant="outline" disabled={post.isPending} onClick={() => post.mutate(d)}><Check /> Post</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{r.next_due ? `Next on ${formatDate(r.next_due)}` : "No upcoming occurrences"}</p>
        )}
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Delete “${r.name}”?`} description="Transactions already posted from this rule are kept." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

export default function RecurringPage() {
  const q = useRecurring();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader title="Recurring" description="Salary, rent, subscriptions and other repeating income or bills." actions={<Button onClick={() => setCreating(true)}><Plus /> New rule</Button>} />
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <LoadingRows rows={3} />
      ) : !q.data.length ? (
        <EmptyState icon={CalendarClock} title="No recurring rules" description="Add your salary or regular bills to see what's coming up and post them with one click." action={<Button onClick={() => setCreating(true)}><Plus /> New rule</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map((r) => <RuleCard key={r.id} r={r} />)}</div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="New recurring rule" wide><RuleForm onDone={() => setCreating(false)} /></FormDialog>
    </>
  );
}
