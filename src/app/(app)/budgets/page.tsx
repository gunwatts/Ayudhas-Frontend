"use client";

import { AlertTriangle, ChevronDown, MoreHorizontal, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader, ProgressBar, utilizationTone } from "@/components/common";
import { AmountInput, CategorySelect, Field } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { formatMoney, isNegative, isValidAmount, normalizeAmount } from "@/lib/money";
import { type Budget, useBudget, useBudgets, useFinanceMutation } from "@/lib/queries";

type Scope = "monthly" | "custom" | "event";
type Values = {
  name: string;
  month: string;
  period_start: string;
  period_end: string;
  amount: string;
  carry_forward: boolean;
  notes: string;
  lines: { category_id: string; amount: string }[];
};

function BudgetForm({ scope, initial, onDone }: { scope: Scope; initial?: Budget; onDone: () => void }) {
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
        }
      : undefined,
    defaultValues: { name: "", month: today().slice(0, 7), period_start: today(), period_end: "", amount: "", carry_forward: false, notes: "", lines: [] },
    resetOptions: { keepDirtyValues: true },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const save = useFinanceMutation(
    (v: Values) => {
      const lineBody = v.lines.filter((l) => l.category_id && l.amount).map((l) => ({ category_id: Number(l.category_id), amount: normalizeAmount(l.amount) }));
      if (initial)
        return api.patch(`/budgets/${initial.id}`, {
          name: v.name.trim() || initial.name,
          amount: normalizeAmount(v.amount),
          carry_forward: v.carry_forward,
          notes: v.notes,
          lines: lineBody,
          ...(scope !== "monthly" ? { period_start: v.period_start, period_end: v.period_end || v.period_start } : {}),
        });
      const [year, month] = v.month.split("-").map(Number);
      return api.post("/budgets", {
        scope,
        name: v.name.trim() || null,
        amount: normalizeAmount(v.amount),
        carry_forward: v.carry_forward,
        notes: v.notes,
        lines: lineBody,
        ...(scope === "monthly" ? { year, month } : { period_start: v.period_start, period_end: v.period_end || null }),
      });
    },
    { success: initial ? "Budget updated" : "Budget created", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalizeAmount(v.amount))) return form.setError("amount", { message: "Enter the budget amount" });
        if (scope !== "monthly" && !initial && !v.name.trim()) return form.setError("name", { message: "Give it a name" });
        if (v.lines.some((l) => l.amount && !isValidAmount(l.amount))) return setError("Check the category limits");
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "month", "amount", "period_start", "period_end"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {scope === "monthly" ? (
          <Field label="Month" required error={e.month?.message}>
            {({ id }) => <Input id={id} type="month" disabled={!!initial} {...form.register("month")} />}
          </Field>
        ) : (
          <Field label={scope === "event" ? "Event" : "Name"} required error={e.name?.message}>
            {({ id, invalid }) => <Input id={id} aria-invalid={invalid} placeholder={scope === "event" ? "e.g. Sister's wedding" : "e.g. Festival season"} {...form.register("name")} />}
          </Field>
        )}
        <Field label="Budget amount" required error={e.amount?.message}>
          {({ id, invalid }) => <AmountInput id={id} aria-invalid={invalid} {...form.register("amount")} />}
        </Field>
        {scope !== "monthly" && (
          <>
            <Field label={scope === "event" ? "Event date" : "From"}>{({ id }) => <Input id={id} type="date" {...form.register("period_start")} />}</Field>
            <Field label={scope === "event" ? "Ends (optional)" : "To"} error={e.period_end?.message}>{({ id }) => <Input id={id} type="date" {...form.register("period_end")} />}</Field>
          </>
        )}
      </div>
      {scope === "monthly" && (
        <Controller
          control={form.control}
          name="carry_forward"
          render={({ field }) => (
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              <span>
                <span className="font-medium">Carry forward unspent money</span>
                <span className="block text-muted-foreground">Adds last month&apos;s unspent budget to this month. It never creates a transaction.</span>
              </span>
            </label>
          )}
        />
      )}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Category limits <span className="font-normal text-muted-foreground">(optional)</span></p>
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
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Create budget"}</Button>
      </div>
    </form>
  );
}

function BudgetLines({ id }: { id: number }) {
  const q = useBudget(id);
  if (!q.data) return <LoadingRows rows={2} />;
  if (!q.data.lines.length) return <p className="text-xs text-muted-foreground">No category limits. Edit the budget to add some.</p>;
  return (
    <ul className="grid gap-3">
      {q.data.lines.map((l) => {
        const pct = Number(l.amount) > 0 ? (Number(l.spent) / Number(l.amount)) * 100 : 0;
        return (
          <li key={l.category.id} className="grid gap-1">
            <div className="flex justify-between text-sm">
              <span>{l.category.name}</span>
              <span className="num text-muted-foreground">{formatMoney(l.spent)} / {formatMoney(l.amount)}</span>
            </div>
            <ProgressBar value={pct} tone={utilizationTone(pct)} label={`${l.category.name} budget used`} />
          </li>
        );
      })}
    </ul>
  );
}

function BudgetCard({ b, onEdit }: { b: Budget; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/budgets/${b.id}`), { success: "Budget deleted" });
  const over = isNegative(b.remaining);
  const util = b.utilization ?? 0;
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{b.name}</p>
            <p className="text-xs text-muted-foreground">
              {b.scope === "monthly" ? "Monthly" : b.scope === "event" ? `Event · ${formatDate(b.period_start)}` : `${formatDate(b.period_start)} – ${formatDate(b.period_end)}`}
              {Number(b.carried_forward) > 0 && ` · +${formatMoney(b.carried_forward)} carried`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {over && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Over</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.name}`}><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground"><Money value={b.spent} className="text-lg font-semibold text-foreground" /> of {formatMoney(b.available)}</p>
          <p className="text-sm"><Money value={b.remaining} tone="auto" className="font-medium" /> <span className="text-muted-foreground">{over ? "over" : "left"}</span></p>
        </div>
        <ProgressBar value={util} tone={utilizationTone(util)} label={`${b.name} budget used`} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 justify-self-start text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> Category limits
        </button>
        {open && <BudgetLines id={b.id} />}
        <ConfirmAction
          open={confirm}
          onOpenChange={setConfirm}
          title={`Delete ${b.name}?`}
          description={b.scope === "event" ? "The event budget is removed; its expenses are kept and will count toward monthly budgets." : "The budget is removed. No transactions change."}
          onConfirm={() => del.mutateAsync(undefined)}
        />
      </CardContent>
    </Card>
  );
}

function BudgetGrid({ scope, onCreate, onEdit }: { scope: Scope; onCreate: () => void; onEdit: (b: Budget) => void }) {
  const q = useBudgets(scope);
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending) return <LoadingRows rows={3} />;
  if (!q.data.length)
    return (
      <EmptyState
        icon={Target}
        title={scope === "monthly" ? "No monthly budgets" : scope === "event" ? "No event budgets" : "No custom budgets"}
        description={scope === "event" ? "Track spending for a wedding, trip or project separately from your monthly budget." : "Set how much you plan to spend and watch progress through the period."}
        action={<Button onClick={onCreate}><Plus /> Create budget</Button>}
      />
    );
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map((b) => <BudgetCard key={b.id} b={b} onEdit={() => onEdit(b)} />)}</div>;
}

export default function BudgetsPage() {
  const [scope, setScope] = useState<Scope>("monthly");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const label = { monthly: "monthly budget", custom: "custom budget", event: "event budget" }[scope];
  return (
    <>
      <PageHeader title="Budgets" description="Planned spending versus actual. Budgets never create transactions." actions={<Button onClick={() => setCreating(true)}><Plus /> New {label}</Button>} />
      <Tabs value={scope} onValueChange={(s) => setScope(s as Scope)}>
        <TabsList className="mb-4">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="event">Events</TabsTrigger>
          <TabsTrigger value="custom">Custom periods</TabsTrigger>
        </TabsList>
        {(["monthly", "event", "custom"] as const).map((s) => (
          <TabsContent key={s} value={s}>
            <BudgetGrid scope={s} onCreate={() => setCreating(true)} onEdit={setEditing} />
          </TabsContent>
        ))}
      </Tabs>
      <FormDialog open={creating} onOpenChange={setCreating} title={`New ${label}`} wide><BudgetForm scope={scope} onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit budget" wide>
        {editing && <BudgetForm scope={editing.scope as Scope} initial={editing} onDone={() => setEditing(null)} />}
      </FormDialog>
    </>
  );
}
