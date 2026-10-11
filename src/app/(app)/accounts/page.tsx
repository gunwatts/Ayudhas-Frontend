"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Banknote, CreditCard, Landmark, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/common";
import { AmountInput, Field, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { today } from "@/lib/dates";
import { addMoney, isValidAmount, normalizeAmount } from "@/lib/money";
import { type Account, useAccounts, useFinanceMutation } from "@/lib/queries";

const TYPES = [
  { value: "bank", label: "Bank account" },
  { value: "savings", label: "Savings account" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Digital wallet" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
] as const;
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bank: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  wallet: Wallet,
  credit_card: CreditCard,
  other: Wallet,
};

const schema = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(100),
  type: z.enum(["bank", "savings", "cash", "wallet", "credit_card", "other"]),
  institution: z.string().max(255),
  allow_negative: z.boolean(),
  notes: z.string().max(5000),
  opening_balance: z.string().refine((v) => !v.trim() || isValidAmount(v), "Enter a valid amount"),
  opening_date: z.string(),
});
type Values = z.infer<typeof schema>;

function AccountForm({ initial, onDone }: { initial?: Account; onDone: () => void }) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type as Values["type"]) ?? "bank",
      institution: initial?.institution ?? "",
      allow_negative: initial?.allow_negative ?? false,
      notes: initial?.notes ?? "",
      opening_balance: "",
      opening_date: today(),
    },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const save = useFinanceMutation(
    (v: Values) => {
      const base = { name: v.name, type: v.type, institution: v.institution, allow_negative: v.allow_negative, notes: v.notes };
      if (initial) return api.patch(`/accounts/${initial.id}`, base);
      return api.post(
        "/accounts",
        { ...base, opening_balance: v.opening_balance.trim() ? normalizeAmount(v.opening_balance) : null, opening_date: v.opening_date || null },
        key,
      );
    },
    { success: initial ? "Account updated" : "Account added", silentError: true },
  );
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await save.mutateAsync(v);
      onDone();
    } catch (e) {
      setError(applyFieldErrors(e, form.setError as never, ["name", "type", "opening_balance"]));
    }
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={e.name?.message}>
          {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. HDFC Savings" {...form.register("name")} />}
        </Field>
        <Field label="Type">
          {({ id }) => <Controller control={form.control} name="type" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={TYPES} />} />}
        </Field>
        <Field label="Bank / provider" className="sm:col-span-2">
          {({ id }) => <Input id={id} placeholder="Optional" {...form.register("institution")} />}
        </Field>
        {!initial && (
          <>
            <Field label="Current balance" error={e.opening_balance?.message} hint="Recorded as an opening balance, not as income.">
              {({ id, invalid, describedBy }) => <AmountInput id={id} aria-invalid={invalid} aria-describedby={describedBy} {...form.register("opening_balance")} />}
            </Field>
            <Field label="As of">
              {({ id }) => <Input id={id} type="date" {...form.register("opening_date")} />}
            </Field>
          </>
        )}
      </div>
      <Controller
        control={form.control}
        name="allow_negative"
        render={({ field }) => (
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
            <span>
              <span className="font-medium">Allow negative balance</span>
              <span className="block text-muted-foreground">{type === "credit_card" ? "Recommended for credit cards: spending makes the balance negative." : "Otherwise spending more than the balance is blocked."}</span>
            </span>
          </label>
        )}
      />
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : initial ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

function AccountCard({ a, onEdit }: { a: Account; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const toggle = useFinanceMutation(() => api.patch(`/accounts/${a.id}`, { is_archived: !a.is_archived }), { success: a.is_archived ? "Account restored" : "Account archived" });
  const del = useFinanceMutation(() => api.delete(`/accounts/${a.id}`), { success: "Account deleted" });
  const Icon = ICONS[a.type] ?? Wallet;
  return (
    <Card className={a.is_archived ? "opacity-60" : undefined}>
      <CardContent className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{a.name}</p>
            {a.is_archived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{[TYPES.find((t) => t.value === a.type)?.label, a.institution].filter(Boolean).join(" · ")}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight">
            <Money value={a.balance} tone="auto" />
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle.mutate(undefined)}>
              {a.is_archived ? <ArchiveRestore /> : <Archive />} {a.is_archived ? "Restore" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmAction
          open={confirm}
          onOpenChange={setConfirm}
          title={`Delete ${a.name}?`}
          description="Only accounts without any transactions can be deleted. Archive it instead to keep its history."
          onConfirm={() => del.mutateAsync(undefined)}
        />
      </CardContent>
    </Card>
  );
}

export default function AccountsPage() {
  const accounts = useAccounts(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const active = accounts.data?.filter((a) => !a.is_archived) ?? [];
  const archived = accounts.data?.filter((a) => a.is_archived) ?? [];
  const total = addMoney(...active.map((a) => a.balance));

  return (
    <>
      <PageHeader
        title="Accounts & wallets"
        description={
          accounts.data ? (
            <>
              Total across active accounts: <Money value={total} tone="auto" className="font-medium text-foreground" />
            </>
          ) : undefined
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add account
          </Button>
        }
      />
      {accounts.error && !accounts.data ? (
        <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
      ) : accounts.isPending ? (
        <LoadingRows rows={4} />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState icon={Wallet} title="No accounts yet" description="Add your bank accounts, cash and wallets to see accurate balances." action={<Button onClick={() => setCreating(true)}><Plus /> Add account</Button>} />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((a) => (
              <AccountCard key={a.id} a={a} onEdit={() => setEditing(a)} />
            ))}
          </div>
          {archived.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Archived</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((a) => (
                  <AccountCard key={a.id} a={a} onEdit={() => setEditing(a)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="Add account">
        <AccountForm onDone={() => setCreating(false)} />
      </FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit account">
        {editing && <AccountForm initial={editing} onDone={() => setEditing(null)} />}
      </FormDialog>
    </>
  );
}
