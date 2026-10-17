"use client";

import { Loader2, Pencil, Plus, Settings2, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common";
import { AccountSelect, AmountInput, BusinessSelect, CategorySelect, Field, NONE, ProjectSelect, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { formatMoney, isValidAmount, normalizeAmount } from "@/lib/money";
import { type QuickTxn, type Txn, useBusinesses, useFinanceMutation, useInvalidateFinance, useQuickTransactions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: NONE, label: "Not specified" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit card" },
  { value: "credit_card", label: "Credit card" },
  { value: "net_banking", label: "Net banking" },
  { value: "other", label: "Other" },
] as const;

type Values = {
  name: string;
  kind: "expense" | "income";
  amount: string;
  account_id: string;
  category_id: string;
  business_id: string;
  project_id: string;
  description: string;
  payment_method: string;
};

function QuickForm({ initial, onDone }: { initial?: QuickTxn; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const businesses = useBusinesses();
  const form = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? "",
      kind: (initial?.kind as Values["kind"]) ?? "expense",
      amount: initial?.amount ?? "",
      account_id: initial?.account ? String(initial.account.id) : "",
      category_id: initial?.category ? String(initial.category.id) : "",
      business_id: initial?.business ? String(initial.business.id) : "",
      project_id: initial?.project ? String(initial.project.id) : "",
      description: initial?.description ?? "",
      payment_method: initial?.payment_method || NONE,
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const businessId = useWatch({ control: form.control, name: "business_id" });
  const save = useFinanceMutation(
    (v: Values) => {
      const id = (s: string) => (s ? Number(s) : null);
      const body = {
        name: v.name.trim(),
        kind: v.kind,
        amount: v.amount.trim() ? normalizeAmount(v.amount) : null,
        account_id: id(v.account_id),
        category_id: id(v.category_id),
        business_id: id(v.business_id),
        project_id: v.business_id ? id(v.project_id) : null,
        description: v.description.trim(),
        payment_method: v.payment_method === NONE || v.kind === "income" ? "" : v.payment_method,
      };
      return initial ? api.patch(`/quick-transactions/${initial.id}`, body) : api.post("/quick-transactions", body);
    },
    { success: initial ? "Shortcut updated" : "Shortcut saved", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!v.name.trim()) return form.setError("name", { message: "Give the shortcut a name" });
        if (v.amount.trim() && !isValidAmount(v.amount)) return form.setError("amount", { message: "Enter a valid amount, or leave it empty" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "amount", "account_id", "category_id", "business_id", "project_id"]));
        }
      })}
    >
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <Tabs
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              form.setValue("category_id", "");
            }}
          >
            <TabsList aria-label="Type">
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={e.name?.message}>
          {({ id, invalid }) => <Input id={id} autoFocus maxLength={60} aria-invalid={invalid} placeholder="e.g. Buy curd" {...form.register("name")} />}
        </Field>
        <Field label="Amount" error={e.amount?.message} hint="Leave empty if it changes each time; you'll be asked when you use it.">
          {({ id, invalid, describedBy }) => <AmountInput id={id} aria-invalid={invalid} aria-describedby={describedBy} {...form.register("amount")} />}
        </Field>
        <Field label={kind === "income" ? "Into account" : "Paid from"} error={e.account_id?.message}>
          {({ id }) => <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} />} />}
        </Field>
        <Field label="Category" error={e.category_id?.message}>
          {({ id }) => <Controller control={form.control} name="category_id" render={({ field }) => <CategorySelect id={id} kind={kind} value={field.value} onChange={field.onChange} />} />}
        </Field>
        {!!businesses.data?.length && (
          <>
            <Field label="For" error={e.business_id?.message}>
              {({ id }) => (
                <Controller
                  control={form.control}
                  name="business_id"
                  render={({ field }) => (
                    <BusinessSelect
                      id={id}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        form.setValue("project_id", "");
                      }}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Project" error={e.project_id?.message}>
              {({ id }) => <Controller control={form.control} name="project_id" render={({ field }) => <ProjectSelect id={id} businessId={businessId} value={field.value} onChange={field.onChange} />} />}
            </Field>
          </>
        )}
        <Field label="Description" hint="Shown on the transaction. Defaults to the shortcut's name.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="Optional" {...form.register("description")} />}
        </Field>
        {kind === "expense" && (
          <Field label="Payment method">
            {({ id }) => <Controller control={form.control} name="payment_method" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={PAYMENT_METHODS} />} />}
          </Field>
        )}
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Save shortcut"}</Button>
      </div>
    </form>
  );
}

function ManageShortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const list = useQuickTransactions();
  const [editing, setEditing] = useState<QuickTxn | "new" | null>(null);
  const [deleting, setDeleting] = useState<QuickTxn | null>(null);
  const del = useFinanceMutation((q: QuickTxn) => api.delete(`/quick-transactions/${q.id}`), { success: "Shortcut deleted" });
  return (
    <>
      <FormDialog open={open && editing === null} onOpenChange={onOpenChange} title="Quick transactions" description="One-tap shortcuts for things you record often. A shortcut only records when you tap it; it never posts by itself.">
        <div className="grid gap-3">
          {list.data?.length ? (
            <ul className="divide-y rounded-xl border">
              {list.data.map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[q.kind === "income" ? "Income" : "Expense", q.amount ? formatMoney(q.amount) : "Amount asked each time", q.account?.name ?? "No account", q.category?.name, q.business?.name, q.project?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${q.name}`} onClick={() => setEditing(q)}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${q.name}`} onClick={() => setDeleting(q)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No shortcuts yet.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setEditing("new")}><Plus /> New shortcut</Button>
          </div>
        </div>
      </FormDialog>
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New shortcut" : "Edit shortcut"}>
        {editing !== null && <QuickForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </FormDialog>
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete the shortcut “${deleting?.name}”?`}
        description="Only the shortcut is removed. Transactions it already recorded stay."
        onConfirm={() => del.mutateAsync(deleting!)}
      />
    </>
  );
}

/** Record a shortcut. One request per tap: the button is disabled while it runs and each tap has its own
 *  idempotency key, so a network retry can never record it twice. */
function useRunShortcut() {
  const invalidate = useInvalidateFinance();
  const [running, setRunning] = useState<number | null>(null);
  const run = async (q: QuickTxn, amount?: string) => {
    if (running !== null) return false;
    setRunning(q.id);
    try {
      const txn = await api.post<Txn>(`/quick-transactions/${q.id}/run`, amount ? { amount: normalizeAmount(amount) } : {}, newIdempotencyKey());
      await invalidate();
      toast.success(`${q.name}: ${formatMoney(txn.amount)} recorded`, {
        action: {
          label: "Undo",
          onClick: () => {
            api
              .delete(`/transactions/${txn.id}`)
              .then(() => invalidate())
              .then(() => toast.success("Removed"))
              .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't undo"));
          },
        },
      });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record it");
      return false;
    } finally {
      setRunning(null);
    }
  };
  return { run, running };
}

function AskAmount({ q, busy, onRun }: { q: QuickTxn; busy: boolean; onRun: (amount: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ChipButton q={q} busy={busy} />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isValidAmount(amount)) return setError("Enter an amount greater than 0");
            setError(null);
            if (await onRun(amount)) {
              setOpen(false);
              setAmount("");
            }
          }}
        >
          <label className="text-sm font-medium" htmlFor={`qa-${q.id}`}>{q.name}: amount</label>
          <AmountInput id={`qa-${q.id}`} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} />
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Recording…" : "Record"}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function ChipButton({ q, busy, ...props }: { q: QuickTxn; busy: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      disabled={busy}
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
        props.className,
      )}
      aria-label={q.amount ? `Record ${q.name}, ${formatMoney(q.amount)}` : `Record ${q.name}`}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Zap className={cn("size-3.5", q.kind === "income" ? "text-positive" : "text-chart-4")} aria-hidden />}
      <span className="max-w-40 truncate">{q.name}</span>
      {q.amount && <span className="num text-xs text-muted-foreground">{formatMoney(q.amount)}</span>}
    </button>
  );
}

/** The row of one-tap shortcuts on the Overview and Transactions pages. */
export function QuickBar() {
  const list = useQuickTransactions();
  const [manage, setManage] = useState(false);
  const { run, running } = useRunShortcut();
  if (list.isPending || list.isError) return null;
  const items = list.data;
  return (
    <section aria-label="Quick transactions" className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Zap className="size-4 text-chart-4" aria-hidden /> Quick add</h2>
        <Button variant="ghost" size="sm" onClick={() => setManage(true)}>
          <Settings2 /> {items.length ? "Manage" : "Set up"}
        </Button>
      </div>
      {items.length ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {items.map((q) =>
            q.amount ? (
              <ChipButton key={q.id} q={q} busy={running === q.id} onClick={() => void run(q)} />
            ) : (
              <AskAmount key={q.id} q={q} busy={running === q.id} onRun={(amount) => run(q, amount)} />
            ),
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setManage(true)} className="rounded-xl border border-dashed px-4 py-3 text-left text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
          Save shortcuts for things you buy often, like a packet of curd, and record them with one tap.
        </button>
      )}
      <ManageShortcuts open={manage} onOpenChange={setManage} />
    </section>
  );
}
