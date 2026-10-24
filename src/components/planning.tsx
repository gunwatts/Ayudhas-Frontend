"use client";

/* Monthly salary (shown on the Income page), events and spending plans (shown on the Events page). In the API all
   three are "budgets" with a scope; the app itself never calls them budgets. */
import { AlertTriangle, CalendarHeart, ChevronDown, MoreHorizontal, Pencil, Plus, Receipt, Sparkles, Target, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, ProgressBar, utilizationTone } from "@/components/common";
import { AccountSelect, AmountInput, CategorySelect, Field } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { AnimatedMoney } from "@/components/motion";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionsList } from "@/components/transactions-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { formatDate, formatMonth, today } from "@/lib/dates";
import { addMoney, formatMoney, isNegative, isValidAmount, isZero, normalizeAmount } from "@/lib/money";
import { type Budget, useBudget, useBudgets, useFinanceMutation, useTransactions } from "@/lib/queries";

export type Scope = "monthly" | "custom" | "event";
type Values = {
  name: string;
  month: string;
  period_start: string;
  period_end: string;
  amount: string;
  carry_forward: boolean;
  notes: string;
  lines: { category_id: string; amount: string }[];
  /** Events: "YYYY-MM" all of the event's expenses count in, or "" for their own months. */
  counts_in_month: string;
  /** Monthly salary: the account it was credited to ("" = not recorded as income) and when. */
  credit_account_id: string;
  credit_date: string;
};

/** The default credit date for a salary month: today when it is that month, otherwise its 1st. */
const creditDateFor = (month: string) => (today().startsWith(month) ? today() : `${month}-01`);

const AMOUNT_LABEL: Record<Scope, string> = { monthly: "Salary for the month", event: "Planned amount", custom: "Planned amount" };
const SOURCE: Record<string, string> = { income: "Recorded salary income", set: "Set for the month", none: "No salary" };

export function PlanForm({ scope, initial, onDone }: { scope: Scope; initial?: Budget; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const detail = useBudget(initial?.id ?? null);
  const form = useForm<Values>({
    values: initial
      ? {
          name: initial.name,
          month: initial.period_start.slice(0, 7),
          period_start: initial.period_start,
          period_end: initial.period_end,
          amount: initial.amount,
          carry_forward: initial.carry_forward,
          notes: initial.notes,
          lines: (detail.data?.lines ?? []).map((l) => ({ category_id: String(l.category.id), amount: l.amount })),
          counts_in_month: initial.counts_in_month?.slice(0, 7) ?? "",
          credit_account_id: "",
          credit_date: creditDateFor(initial.period_start.slice(0, 7)),
        }
      : undefined,
    defaultValues: {
      name: "",
      month: today().slice(0, 7),
      period_start: today(),
      period_end: "",
      amount: "",
      carry_forward: false,
      notes: "",
      lines: [],
      counts_in_month: "",
      credit_account_id: "",
      credit_date: today(),
    },
    resetOptions: { keepDirtyValues: true },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const creditAccount = useWatch({ control: form.control, name: "credit_account_id" });
  const save = useFinanceMutation(
    (v: Values) => {
      const lineBody = v.lines.filter((l) => l.category_id && l.amount).map((l) => ({ category_id: Number(l.category_id), amount: normalizeAmount(l.amount) }));
      const amount = scope === "event" && !v.amount.trim() ? "0" : normalizeAmount(v.amount);
      const extra = {
        ...(scope === "event" ? { counts_in_month: v.counts_in_month ? `${v.counts_in_month}-01` : null } : {}),
        ...(scope === "monthly" && v.credit_account_id ? { credit_account_id: Number(v.credit_account_id), credit_date: v.credit_date || null } : {}),
      };
      if (initial)
        return api.patch(`/budgets/${initial.id}`, {
          name: v.name.trim() || initial.name,
          amount,
          carry_forward: v.carry_forward,
          notes: v.notes,
          lines: lineBody,
          ...(scope !== "monthly" ? { period_start: v.period_start, period_end: v.period_end || v.period_start } : {}),
          ...extra,
        });
      const [year, month] = v.month.split("-").map(Number);
      return api.post("/budgets", {
        scope,
        name: v.name.trim() || null,
        amount,
        carry_forward: v.carry_forward,
        notes: v.notes,
        lines: lineBody,
        ...(scope === "monthly" ? { year, month } : { period_start: v.period_start, period_end: v.period_end || null }),
        ...extra,
      });
    },
    { success: initial ? "Saved" : scope === "monthly" ? "Salary saved" : scope === "event" ? "Event created" : "Spending plan created", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        const optional = scope === "event" && !v.amount.trim();
        if (!optional && !/^\d{1,12}(\.\d{1,2})?$/.test(normalizeAmount(v.amount)))
          return form.setError("amount", { message: scope === "monthly" ? "Enter your salary for the month" : "Enter the amount" });
        if (scope !== "monthly" && !initial && !v.name.trim()) return form.setError("name", { message: "Give it a name" });
        if (v.lines.some((l) => l.amount && !isValidAmount(l.amount))) return setError("Check the category limits");
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "month", "amount", "period_start", "period_end", "counts_in_month", "credit_account_id", "credit_date"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {scope === "monthly" ? (
          <Field label="Month" required error={e.month?.message}>
            {({ id }) => <Input id={id} type="month" disabled={!!initial} {...form.register("month")} />}
          </Field>
        ) : (
          <Field label={scope === "event" ? "Event name" : "Name"} required error={e.name?.message}>
            {({ id, invalid }) => <Input id={id} aria-invalid={invalid} placeholder={scope === "event" ? "e.g. Sister's wedding" : "e.g. Festival season"} {...form.register("name")} />}
          </Field>
        )}
        <Field
          label={AMOUNT_LABEL[scope]}
          required={scope !== "event"}
          error={e.amount?.message}
          hint={
            scope === "monthly"
              ? "Your salary this month. Spending is deducted from it. If you record your salary as income under the Salary category, that amount is used instead."
              : scope === "event"
                ? "Optional. How much you plan to spend on this event."
                : undefined
          }
        >
          {({ id, invalid, describedBy }) => <AmountInput id={id} aria-invalid={invalid} aria-describedby={describedBy} {...form.register("amount")} />}
        </Field>
        {scope !== "monthly" && (
          <>
            <Field label={scope === "event" ? "Event date" : "From"}>{({ id }) => <Input id={id} type="date" {...form.register("period_start")} />}</Field>
            <Field label={scope === "event" ? "Ends (optional)" : "To"} error={e.period_end?.message}>{({ id }) => <Input id={id} type="date" {...form.register("period_end")} />}</Field>
          </>
        )}
      </div>
      {scope === "event" && (
        <Field
          label="Count all its expenses in"
          error={e.counts_in_month?.message}
          hint="Optional. Pick a month to count every expense of this event in that month's spending, e.g. a trip paid partly at the start of the next month. Nothing is copied: each expense still counts once. Leave empty to count each in its own month."
        >
          {({ id, describedBy }) => <Input id={id} type="month" aria-describedby={describedBy} {...form.register("counts_in_month")} />}
        </Field>
      )}
      {scope === "monthly" &&
        (initial?.salary_source === "income" ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Salary income is already recorded for this month, so it is used as the salary.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="credit_account_id"
              render={({ field }) => (
                <Field label="Credited to" error={e.credit_account_id?.message} hint="Optional. Records the salary as Salary income in this account, so its balance includes it.">
                  {({ id, describedBy }) => <AccountSelect id={id} describedBy={describedBy} value={field.value} onChange={field.onChange} noneLabel="Don't record it as income" />}
                </Field>
              )}
            />
            {creditAccount && (
              <Field label="Credited on" error={e.credit_date?.message} hint="A date in the salary's month.">
                {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} {...form.register("credit_date")} />}
              </Field>
            )}
          </div>
        ))}
      {scope === "monthly" && (
        <Controller
          control={form.control}
          name="carry_forward"
          render={({ field }) => (
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              <span>
                <span className="font-medium">Carry forward what&apos;s left</span>
                <span className="block text-muted-foreground">Adds last month&apos;s unspent salary to this month. It never creates a transaction.</span>
              </span>
            </label>
          )}
        />
      )}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Spending limits by category <span className="font-normal text-muted-foreground">(optional)</span></p>
          <Button type="button" variant="ghost" size="sm" onClick={() => lines.append({ category_id: "", amount: "" })}><Plus /> Add limit</Button>
        </div>
        {lines.fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
            <Controller control={form.control} name={`lines.${i}.category_id`} render={({ field }) => <CategorySelect kind="expense" value={field.value} onChange={field.onChange} />} />
            <AmountInput aria-label="Limit" {...form.register(`lines.${i}.amount`)} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove limit" onClick={() => lines.remove(i)}><X /></Button>
          </div>
        ))}
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : initial ? "Save changes" : scope === "monthly" ? "Save salary" : scope === "event" ? "Create event" : "Create plan"}
        </Button>
      </div>
    </form>
  );
}

function PlanLines({ id }: { id: number }) {
  const q = useBudget(id);
  if (!q.data) return <LoadingRows rows={2} />;
  if (!q.data.lines.length) return <p className="text-xs text-muted-foreground">No category limits. Edit to add some.</p>;
  return (
    <ul className="grid gap-3">
      {q.data.lines.map((l) => {
        const pct = Number(l.amount) > 0 ? (Number(l.spent) / Number(l.amount)) * 100 : 0;
        return (
          <li key={l.category.id} className="grid gap-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{l.category.name}</span>
              <span className="num shrink-0 text-muted-foreground">{formatMoney(l.spent)} / {formatMoney(l.amount)}</span>
            </div>
            <ProgressBar value={pct} tone={utilizationTone(pct)} label={`${l.category.name} limit used`} />
          </li>
        );
      })}
    </ul>
  );
}

function CardMenu({ b, onEdit, onDelete }: { b: Budget; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.name}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A month's salary, what was spent (event spending included) and what's left. */
export function SalaryMonthCard({ b, onEdit, index }: { b: Budget; onEdit: () => void; index: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/budgets/${b.id}`), { success: "Salary month removed" });
  const over = isNegative(b.remaining);
  const util = b.utilization ?? 0;
  return (
    <Card className="lift animate-rise" style={{ ["--delay" as string]: `${Math.min(index, 8) * 0.04}s` }}>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{formatMonth(b.period_start.slice(0, 7))}</p>
            <p className="text-xs text-muted-foreground">
              {SOURCE[b.salary_source ?? "set"]}
              {Number(b.carried_forward) > 0 && ` · +${formatMoney(b.carried_forward)} carried`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {over && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Over</Badge>}
            <CardMenu b={b} onEdit={onEdit} onDelete={() => setConfirm(true)} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Salary</dt>
            <dd className="truncate text-sm font-semibold text-salary"><AnimatedMoney value={b.salary ?? b.amount} /></dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Spent</dt>
            <dd className="truncate text-sm font-semibold"><AnimatedMoney value={b.spent} /></dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{over ? "Over by" : "Left"}</dt>
            <dd className="truncate text-sm font-semibold"><AnimatedMoney value={b.remaining} tone="auto" /></dd>
          </div>
        </dl>
        <ProgressBar value={util} tone={utilizationTone(util)} label={`${b.name}: share of salary spent`} />
        {b.linked_events.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Includes {b.linked_events.length === 1 ? "event" : "events"}:{" "}
            {b.linked_events.map((ev, i) => (
              <span key={ev.id}>
                {i ? ", " : ""}
                <span className="font-medium text-foreground">{ev.name}</span> {formatMoney(ev.spent)}
              </span>
            ))}
          </p>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 justify-self-start text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> Category limits
        </button>
        {open && <PlanLines id={b.id} />}
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Remove the salary for ${b.name}?`} description="Only the salary amount for this month is removed. No transactions change." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

export function CustomCard({ b, onEdit, index }: { b: Budget; onEdit: () => void; index: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/budgets/${b.id}`), { success: "Spending plan deleted" });
  const over = isNegative(b.remaining);
  const util = b.utilization ?? 0;
  return (
    <Card className="lift animate-rise" style={{ ["--delay" as string]: `${Math.min(index, 8) * 0.04}s` }}>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{b.name}</p>
            <p className="text-xs text-muted-foreground">{formatDate(b.period_start)} – {formatDate(b.period_end)}</p>
          </div>
          <div className="flex items-center gap-1">
            {over && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Over</Badge>}
            <CardMenu b={b} onEdit={onEdit} onDelete={() => setConfirm(true)} />
          </div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground"><AnimatedMoney value={b.spent} className="text-lg font-semibold text-foreground" /> of {formatMoney(b.available)}</p>
          <p className="text-sm"><Money value={b.remaining} tone="auto" className="font-medium" /> <span className="text-muted-foreground">{over ? "over" : "left"}</span></p>
        </div>
        <ProgressBar value={util} tone={utilizationTone(util)} label={`${b.name}: share of plan used`} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 justify-self-start text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> Category limits
        </button>
        {open && <PlanLines id={b.id} />}
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Delete ${b.name}?`} description="The spending plan is removed. No transactions change." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

/** The transactions linked to an event, grouped by the month they count in. */
function EventTransactions({ id }: { id: number }) {
  const q = useTransactions({ event_id: id, sort: "-date", page_size: 200 });
  const byMonth = useMemo(() => {
    const totals = new Map<string, string>();
    for (const t of q.data?.items ?? []) {
      const m = t.date.slice(0, 7);
      const signed = t.kind === "refund" ? `-${t.amount}` : t.amount;
      totals.set(m, addMoney(totals.get(m) ?? "0", signed));
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingRows rows={2} />;
  return (
    <div className="grid gap-3">
      {byMonth.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">Counts in these months&apos; spending</p>
          <ul className="flex flex-wrap gap-1.5">
            {byMonth.map(([m, total]) => (
              <li key={m} className="rounded-full border bg-card px-2.5 py-1 text-xs">
                {formatMonth(m)} · <span className="num font-medium">{formatMoney(total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <TransactionsList items={q.data.items} emptyTitle="No expenses linked yet" emptyDescription="Use “Add expense” to record what you spent on this event." />
    </div>
  );
}

export function EventCard({ b, onEdit, onAdd, index }: { b: Budget; onEdit: () => void; onAdd: () => void; index: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/budgets/${b.id}`), { success: "Event deleted" });
  const planned = !isZero(b.amount);
  const over = planned && isNegative(b.remaining);
  const util = b.utilization ?? 0;
  const count = b.transaction_count ?? 0;
  const span = b.first_date && b.last_date ? (b.first_date === b.last_date ? formatDate(b.first_date) : `${formatDate(b.first_date)} – ${formatDate(b.last_date)}`) : null;
  return (
    <Card className="lift animate-rise relative overflow-hidden" style={{ ["--delay" as string]: `${Math.min(index, 8) * 0.04}s` }}>
      <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-chart-7/20 blur-2xl" />
      <CardContent className="relative grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-chart-7/15 text-chart-7"><CalendarHeart className="size-4" aria-hidden /></span>
            <div className="min-w-0">
              <p className="truncate font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(b.period_start)}
                {b.period_end !== b.period_start && ` – ${formatDate(b.period_end)}`} · {count} expense{count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {over && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Over plan</Badge>}
            <CardMenu b={b} onEdit={onEdit} onDelete={() => setConfirm(true)} />
          </div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            <AnimatedMoney value={b.spent} className="text-xl font-semibold text-foreground" /> spent
            {planned && <> of {formatMoney(b.amount)} planned</>}
          </p>
          {planned && <p className="text-sm"><Money value={b.remaining} tone="auto" className="font-medium" /> <span className="text-muted-foreground">{over ? "over" : "left"}</span></p>}
        </div>
        {planned ? <ProgressBar value={util} tone={utilizationTone(util)} label={`${b.name}: share of planned amount used`} /> : <p className="text-xs text-muted-foreground">No planned amount. Edit the event to set one.</p>}
        {span && <p className="text-xs text-muted-foreground">Spending dates: {span}</p>}
        {b.counts_in_month && (
          <p className="text-xs text-muted-foreground">
            All its expenses count in <span className="font-medium text-foreground">{formatMonth(b.counts_in_month.slice(0, 7))}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onAdd}><Plus /> Add expense</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Receipt /> {open ? "Hide" : "Show"} transactions
          </Button>
        </div>
        {open && <EventTransactions id={b.id} />}
        <ConfirmAction
          open={confirm}
          onOpenChange={setConfirm}
          title={`Delete ${b.name}?`}
          description="The event is removed. Its expenses are kept, and they count in their own months' spending."
          onConfirm={() => del.mutateAsync(undefined)}
        />
      </CardContent>
    </Card>
  );
}

export function PlanGrid({ scope, onCreate, onEdit, onAddExpense }: { scope: Scope; onCreate: () => void; onEdit: (b: Budget) => void; onAddExpense: (b: Budget) => void }) {
  const q = useBudgets(scope);
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending) return <LoadingRows rows={3} />;
  if (!q.data.length)
    return (
      <EmptyState
        icon={scope === "event" ? CalendarHeart : scope === "monthly" ? Sparkles : Target}
        title={scope === "monthly" ? "No salary set yet" : scope === "event" ? "No events yet" : "No spending plans yet"}
        description={
          scope === "monthly"
            ? "Set your salary for a month to see what you spent and what's left."
            : scope === "event"
              ? "Group the expenses of a wedding, trip or festival. You can also type an event name when you add an expense."
              : "Set how much you plan to spend over a period and watch progress."
        }
        action={<Button onClick={onCreate}><Plus /> {scope === "monthly" ? "Set monthly salary" : scope === "event" ? "New event" : "New spending plan"}</Button>}
      />
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {q.data.map((b, i) =>
        scope === "monthly" ? (
          <SalaryMonthCard key={b.id} b={b} index={i} onEdit={() => onEdit(b)} />
        ) : scope === "event" ? (
          <EventCard key={b.id} b={b} index={i} onEdit={() => onEdit(b)} onAdd={() => onAddExpense(b)} />
        ) : (
          <CustomCard key={b.id} b={b} index={i} onEdit={() => onEdit(b)} />
        ),
      )}
    </div>
  );
}

/** One kind of plan as a page section, with its create / edit / add-expense dialogs. */
export function PlanSection({ scope, creating, onCreatingChange }: { scope: Scope; creating: boolean; onCreatingChange: (open: boolean) => void }) {
  const [editing, setEditing] = useState<Budget | null>(null);
  const [addingTo, setAddingTo] = useState<Budget | null>(null);
  const createTitle = { monthly: "Set monthly salary", custom: "New spending plan", event: "New event" }[scope];
  const editTitle = { monthly: "Edit monthly salary", custom: "Edit spending plan", event: "Edit event" }[scope];
  return (
    <>
      <PlanGrid scope={scope} onCreate={() => onCreatingChange(true)} onEdit={setEditing} onAddExpense={setAddingTo} />
      <FormDialog open={creating} onOpenChange={onCreatingChange} title={createTitle} wide>
        <PlanForm scope={scope} onDone={() => onCreatingChange(false)} />
      </FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editTitle} wide>
        {editing && <PlanForm scope={scope} initial={editing} onDone={() => setEditing(null)} />}
      </FormDialog>
      <FormDialog open={!!addingTo} onOpenChange={(o) => !o && setAddingTo(null)} title={addingTo ? `Add expense to ${addingTo.name}` : "Add expense"}>
        {addingTo && <TransactionForm defaultKind="expense" defaultEventName={addingTo.name} onDone={() => setAddingTo(null)} />}
      </FormDialog>
    </>
  );
}
