"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader, ProgressBar, StatCard } from "@/components/common";
import { AccountSelect, AmountInput, Field } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, applyFieldErrors } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { addMoney, formatMoney, isValidAmount, normalizeAmount, toPaise } from "@/lib/money";
import { type Goal, useFinanceMutation, useGoals, usePositions } from "@/lib/queries";

const goalSchema = z.object({
  name: z.string().trim().min(1, "Name your goal").max(150),
  target_amount: z.string().refine(isValidAmount, "Enter the target amount"),
  target_date: z.string(),
  account_id: z.string(),
  notes: z.string().max(5000),
});
type GoalValues = z.infer<typeof goalSchema>;

function GoalForm({ initial, onDone }: { initial?: Goal; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: initial?.name ?? "",
      target_amount: initial?.target_amount ?? "",
      target_date: initial?.target_date ?? "",
      account_id: initial?.account ? String(initial.account.id) : "",
      notes: initial?.notes ?? "",
    },
  });
  const save = useFinanceMutation(
    (v: GoalValues) => {
      const body = { name: v.name, target_amount: normalizeAmount(v.target_amount), target_date: v.target_date || null, account_id: v.account_id ? Number(v.account_id) : null, notes: v.notes };
      return initial ? api.patch(`/goals/${initial.id}`, body) : api.post("/goals", body);
    },
    { success: initial ? "Goal updated" : "Goal created", silentError: true },
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
        <Field label="Goal" required error={e.name?.message} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. Emergency fund" {...form.register("name")} />}
        </Field>
        <Field label="Target amount" required error={e.target_amount?.message}>
          {({ id, invalid }) => <AmountInput id={id} aria-invalid={invalid} {...form.register("target_amount")} />}
        </Field>
        <Field label="Target date">{({ id }) => <Input id={id} type="date" {...form.register("target_date")} />}</Field>
        <Field label="Saving in account" hint="Optional — where you keep this money" className="sm:col-span-2">
          {({ id, describedBy }) => (
            <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} describedBy={describedBy} noneLabel="Any account" />} />
          )}
        </Field>
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Create goal"}</Button>
      </div>
    </form>
  );
}

function AllocateForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const [mode, setMode] = useState<"add" | "release">("add");
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { amount: "", date: today(), note: "" } });
  const save = useFinanceMutation(
    (v: { amount: string; date: string; note: string }) =>
      api.post(`/goals/${goal.id}/allocations`, { amount: `${mode === "release" ? "-" : ""}${normalizeAmount(v.amount)}`, date: v.date, note: v.note }),
    { success: mode === "add" ? "Added to goal" : "Released from goal", silentError: true },
  );
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!isValidAmount(v.amount)) return form.setError("amount", { message: "Enter an amount" });
        if (mode === "release" && toPaise(v.amount) > toPaise(goal.allocated)) return form.setError("amount", { message: `Only ${formatMoney(goal.allocated)} is set aside` });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["amount", "date"]));
        }
      })}
    >
      <Tabs value={mode} onValueChange={(m) => setMode(m as "add" | "release")}>
        <TabsList className="w-full">
          <TabsTrigger value="add" className="flex-1">Set aside</TabsTrigger>
          <TabsTrigger value="release" className="flex-1" disabled={toPaise(goal.allocated) === BigInt(0)}>Release</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required error={form.formState.errors.amount?.message}>
          {({ id }) => <AmountInput id={id} autoFocus {...form.register("amount")} />}
        </Field>
        <Field label="Date">{({ id }) => <Input id={id} type="date" {...form.register("date")} />}</Field>
      </div>
      <Field label="Note">{({ id }) => <Input id={id} {...form.register("note")} />}</Field>
      <p className="text-xs text-muted-foreground">This only earmarks money for the goal — no money moves, and your balances don&apos;t change.</p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : mode === "add" ? "Set aside" : "Release"}</Button>
      </div>
    </form>
  );
}

function GoalCard({ g, onEdit, onAllocate }: { g: Goal; onEdit: () => void; onAllocate: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/goals/${g.id}`), { success: "Goal deleted" });
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{g.name}</p>
              {g.is_completed && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Reached</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Target {formatMoney(g.target_amount)}
              {g.target_date && ` by ${formatDate(g.target_date)}`}
              {g.account && ` · ${g.account.name}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-xl font-semibold tracking-tight"><Money value={g.allocated} /></p>
          <p className="num text-sm text-muted-foreground">{g.progress.toFixed(0)}%</p>
        </div>
        <ProgressBar value={g.progress} tone={g.is_completed ? "positive" : "primary"} label={`${g.name} progress`} />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{g.is_completed ? "Goal reached" : `${formatMoney(g.remaining)} to go${g.monthly_needed ? ` · ${formatMoney(g.monthly_needed)}/month` : ""}`}</span>
          <Button variant="outline" size="sm" onClick={onAllocate}>Update</Button>
        </div>
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Delete “${g.name}”?`} description="The goal and its allocations are removed. No balances change." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

export default function SavingsPage() {
  const goals = useGoals();
  const pos = usePositions();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [allocating, setAllocating] = useState<Goal | null>(null);
  const allocated = addMoney(...(goals.data ?? []).filter((g) => !g.is_completed).map((g) => g.allocated));

  return (
    <>
      <PageHeader title="Savings goals" description="Set targets and earmark money toward them." actions={<Button onClick={() => setCreating(true)}><Plus /> New goal</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Savings accounts" value={pos.data?.savings_balance} loading={pos.isPending} hint="Balance of accounts marked “Savings”" />
        <StatCard label="Set aside for goals" value={allocated} loading={goals.isPending} hint="Earmarks only; not deducted from balances" />
        <StatCard label="Available to you" value={pos.data?.personal_available} loading={pos.isPending} tone="auto" hint="Your money across all accounts" />
      </div>
      {goals.error && !goals.data ? (
        <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
      ) : goals.isPending ? (
        <LoadingRows rows={3} />
      ) : !goals.data.length ? (
        <EmptyState icon={PiggyBank} title="No savings goals" description="Create a goal — an emergency fund, a trip, a laptop — and track progress toward it." action={<Button onClick={() => setCreating(true)}><Plus /> New goal</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.data.map((g) => <GoalCard key={g.id} g={g} onEdit={() => setEditing(g)} onAllocate={() => setAllocating(g)} />)}
        </div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="New savings goal"><GoalForm onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit goal">{editing && <GoalForm initial={editing} onDone={() => setEditing(null)} />}</FormDialog>
      <FormDialog open={!!allocating} onOpenChange={(o) => !o && setAllocating(null)} title={allocating ? `Update “${allocating.name}”` : ""}>{allocating && <AllocateForm goal={allocating} onDone={() => setAllocating(null)} />}</FormDialog>
    </>
  );
}
