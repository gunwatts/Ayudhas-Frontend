"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCheck, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ConfirmAction, ErrorState, LoadingRows, Money, StatCard } from "@/components/common";
import { AccountSelect, AmountInput, Field, useDefaultAccount } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { LOAN_TYPES, LoanForm, METHODS } from "@/components/loans";
import { AmountCell } from "@/components/transactions-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { addMoney, formatMoney, isValidAmount, normalizeAmount, subMoney } from "@/lib/money";
import { type LoanDetail, type Txn, useFinanceMutation, useLoan } from "@/lib/queries";

const opt = z.string().refine((v) => !v.trim() || /^\d{1,12}(\.\d{1,2})?$/.test(v.trim()), "Invalid amount");
const repaySchema = z.object({
  amount: z.string().refine(isValidAmount, "Enter the amount paid"),
  date: z.string().min(1, "Choose a date"),
  account_id: z.string(),
  custom: z.boolean(),
  principal: opt,
  interest: opt,
  fee: opt,
  notes: z.string().max(5000),
});
type RepayValues = z.infer<typeof repaySchema>;

function RepaymentForm({ loan, onDone }: { loan: LoanDetail; onDone: () => void }) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const isGiven = loan.direction === "given";
  const form = useForm<RepayValues>({
    resolver: zodResolver(repaySchema),
    defaultValues: {
      amount: loan.state.next_due_amount && !isGiven ? loan.state.next_due_amount : "",
      date: today(),
      account_id: "",
      custom: false,
      principal: "",
      interest: "",
      fee: "",
      notes: "",
    },
  });
  const v = useWatch({ control: form.control }) as RepayValues;
  // A repayment you receive comes into one of your accounts and raises your available balance.
  const setAccount = useCallback((id: string) => form.setValue("account_id", id), [form]);
  const { hasAccounts } = useDefaultAccount(v.account_id ?? "", setAccount, isGiven);
  const accountRequired = isGiven && hasAccounts;

  async function suggest() {
    if (!isValidAmount(v.amount)) return;
    setSuggesting(true);
    try {
      const s = await api.get<{ principal: string; interest: string }>(`/loans/${loan.id}/split`, { amount: normalizeAmount(v.amount) });
      form.setValue("principal", s.principal);
      form.setValue("interest", s.interest);
      form.setValue("fee", "");
    } finally {
      setSuggesting(false);
    }
  }

  const save = useFinanceMutation(
    (values: RepayValues) =>
      api.post(
        `/loans/${loan.id}/repayments`,
        {
          amount: normalizeAmount(values.amount),
          date: values.date,
          account_id: values.account_id ? Number(values.account_id) : null,
          principal: values.custom && values.principal ? normalizeAmount(values.principal) : null,
          interest: values.custom && values.interest ? normalizeAmount(values.interest) : null,
          fee: values.custom && values.fee ? normalizeAmount(values.fee) : null,
          notes: values.notes,
        },
        key,
      ),
    { success: "Repayment recorded", silentError: true },
  );
  const onSubmit = form.handleSubmit(async (values) => {
    if (accountRequired && !values.account_id) return form.setError("account_id", { message: "Choose the account the money came into" });
    setError(null);
    try {
      await save.mutateAsync(values);
      onDone();
    } catch (e) {
      setError(applyFieldErrors(e, form.setError as never, ["amount", "date", "account_id", "principal", "interest", "fee"]));
    }
  });
  const e = form.formState.errors;
  const splitTotal = v.custom ? addMoney(v.principal || "0", v.interest || "0", v.fee || "0") : null;
  const splitMismatch = v.custom && isValidAmount(v.amount) && splitTotal !== addMoney(normalizeAmount(v.amount));

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount paid" required error={e.amount?.message}>
          {({ id, invalid }) => <AmountInput id={id} autoFocus aria-invalid={invalid} {...form.register("amount", { onBlur: () => v.custom && suggest() })} />}
        </Field>
        <Field label="Date" required error={e.date?.message}>
          {({ id }) => <Input id={id} type="date" {...form.register("date")} />}
        </Field>
        <Field label={isGiven ? "Received into" : "Paid from"} className="sm:col-span-2" required={accountRequired} error={e.account_id?.message}>
          {({ id, invalid }) => (
            <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} invalid={invalid} allowNone={!accountRequired} />} />
          )}
        </Field>
      </div>
      <div className="rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={v.custom}
            onChange={(ev) => {
              form.setValue("custom", ev.target.checked);
              if (ev.target.checked) suggest();
            }}
          />
          Split principal, interest and fees myself
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Otherwise interest is taken first (estimated from the outstanding balance) and the rest reduces the principal. Use your lender&apos;s statement for exact figures.
        </p>
        {v.custom && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Principal" error={e.principal?.message}>
              {({ id }) => <AmountInput id={id} {...form.register("principal")} />}
            </Field>
            <Field label="Interest" error={e.interest?.message}>
              {({ id }) => <AmountInput id={id} {...form.register("interest")} />}
            </Field>
            <Field label="Fees / charges" error={e.fee?.message}>
              {({ id }) => <AmountInput id={id} {...form.register("fee")} />}
            </Field>
            <p className={`text-xs sm:col-span-3 ${splitMismatch ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
              {suggesting ? "Calculating suggestion…" : `Split total ${formatMoney(splitTotal)}${splitMismatch ? ` — must equal ${formatMoney(normalizeAmount(v.amount))}` : ""}`}
            </p>
          </div>
        )}
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <p className="text-xs text-muted-foreground">Outstanding principal before this payment: {formatMoney(loan.state.outstanding_principal)}</p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || splitMismatch}>
          {save.isPending ? "Saving…" : "Record repayment"}
        </Button>
      </div>
    </form>
  );
}

function DisbursementForm({ loan, onDone }: { loan: LoanDetail; onDone: () => void }) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { amount: "", date: today(), account_id: "", notes: "" } });
  const isGiven = loan.direction === "given";
  const accountValue = useWatch({ control: form.control, name: "account_id" });
  const setAccount = useCallback((id: string) => form.setValue("account_id", id), [form]);
  const { hasAccounts } = useDefaultAccount(accountValue, setAccount, isGiven);
  const accountRequired = isGiven && hasAccounts;
  const save = useFinanceMutation(
    (v: { amount: string; date: string; account_id: string; notes: string }) =>
      api.post(`/loans/${loan.id}/disbursements`, { amount: normalizeAmount(v.amount), date: v.date, account_id: v.account_id ? Number(v.account_id) : null, notes: v.notes }, key),
    { success: "Additional amount recorded", silentError: true },
  );
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!isValidAmount(v.amount)) return form.setError("amount", { message: "Enter a valid amount" });
        if (accountRequired && !v.account_id) return form.setError("account_id", { message: "Choose the account the money was paid from" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (e) {
          setError(applyFieldErrors(e, form.setError as never, ["amount", "date", "account_id"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required error={form.formState.errors.amount?.message}>
          {({ id }) => <AmountInput id={id} autoFocus {...form.register("amount")} />}
        </Field>
        <Field label="Date">{({ id }) => <Input id={id} type="date" {...form.register("date")} />}</Field>
        <Field label={isGiven ? "Paid from" : "Received into"} className="sm:col-span-2" required={accountRequired} error={form.formState.errors.account_id?.message}>
          {({ id, invalid }) => (
            <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} invalid={invalid} allowNone={!accountRequired} />} />
          )}
        </Field>
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Record"}</Button>
      </div>
    </form>
  );
}

/** For a loan that was already running when it was added: mark installments 1..N as paid before tracking began. */
function PastInstallmentsForm({ loan, onDone }: { loan: LoanDetail; onDone: () => void }) {
  const fallenDue = loan.schedule.filter((r) => r.due_date <= today()).length;
  const [count, setCount] = useState(String(Math.max(fallenDue, loan.state.installments_covered)));
  const [error, setError] = useState<string | null>(null);
  const n = Number(count);
  const valid = /^\d+$/.test(count) && n >= 1 && n <= loan.schedule.length;
  const toRecord = valid ? loan.schedule.slice(0, n).filter((r) => r.status !== "paid") : [];
  const save = useFinanceMutation(() => api.post<LoanDetail>(`/loans/${loan.id}/past-installments`, { installments_paid: n }), {
    success: "Installments marked as paid",
    silentError: true,
  });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return setError(`Enter a number from 1 to ${loan.schedule.length}`);
        setError(null);
        try {
          await save.mutateAsync(undefined);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, () => {}, []));
        }
      }}
    >
      <Field label="Installments paid so far" hint={`${fallenDue} of ${loan.schedule.length} have fallen due by today.`}>
        {({ id, describedBy }) => <Input id={id} autoFocus inputMode="numeric" aria-describedby={describedBy} value={count} onChange={(e) => setCount(e.target.value)} />}
      </Field>
      <p className="text-sm text-muted-foreground">
        {toRecord.length
          ? `Records ${toRecord.length} repayment${toRecord.length === 1 ? "" : "s"} of ${formatMoney(toRecord.reduce((t, r) => addMoney(t, r.amount), "0"))} on their due dates, split into principal and interest as scheduled. No account balance changes.`
          : "These installments are already covered."}
      </p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || !toRecord.length}>{save.isPending ? "Saving…" : "Mark as paid"}</Button>
      </div>
    </form>
  );
}

const STATUS_STYLE: Record<string, { label: string; variant: "secondary" | "destructive" | "outline" | "default" }> = {
  paid: { label: "Paid", variant: "secondary" },
  partial: { label: "Part paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  due: { label: "Due soon", variant: "default" },
  upcoming: { label: "Upcoming", variant: "outline" },
};

/** Attach the account a past entry went through (e.g. money lent that was recorded without an account). */
function SetAccountForm({ loan, txn, onDone }: { loan: LoanDetail; txn: Txn; onDone: () => void }) {
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useFinanceMutation(() => api.patch(`/loans/${loan.id}/transactions/${txn.id}`, { account_id: accountId ? Number(accountId) : null }), {
    success: "Account set",
    silentError: true,
  });
  const into = txn.kind === "lend_repayment" || txn.kind === "loan_disbursement";
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!accountId) return setError("Choose an account");
        setError(null);
        try {
          await save.mutateAsync(undefined);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, () => {}, []));
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        {txn.kind_label} of {formatMoney(txn.amount)} on {formatDate(txn.date)}. The account&apos;s balance will {into ? "go up" : "go down"} by this amount.
      </p>
      <Field label={into ? "Received into" : "Paid from"}>{({ id }) => <AccountSelect id={id} value={accountId} onChange={setAccountId} allowNone={false} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function LoanDetailView({ id }: { id: number }) {
  const loan = useLoan(id);
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "repay" | "disburse" | "edit" | "delete" | "past">(null);
  const [deleting, setDeleting] = useState<Txn | null>(null);
  const [accountFor, setAccountFor] = useState<Txn | null>(null);
  const [showAll, setShowAll] = useState(false);
  const delTxn = useFinanceMutation((t: Txn) => api.delete(`/loans/${id}/transactions/${t.id}`), { success: "Entry deleted" });
  const delLoan = useFinanceMutation(() => api.delete(`/loans/${id}`), { success: "Loan deleted" });
  const setStatus = useFinanceMutation((status: string) => api.patch(`/loans/${id}`, { status }), { success: "Loan updated" });

  if (loan.error && !loan.data) return <ErrorState error={loan.error} onRetry={() => loan.refetch()} />;
  if (!loan.data) return <LoadingRows rows={6} />;
  const l = loan.data;
  const st = l.state;
  const isGiven = l.direction === "given";
  const backHref = isGiven ? "/lent/" : "/loans/";
  const schedule = showAll ? l.schedule : l.schedule.filter((r) => r.status !== "paid").slice(0, 12);

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={backHref}><ArrowLeft /> {isGiven ? "Money lent" : "Loans taken"}</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{l.name}</h1>
              <Badge variant={l.status === "active" ? (st.overdue_count ? "destructive" : "outline") : "secondary"}>
                {l.status === "active" ? (st.overdue_count ? "Overdue" : "Active") : l.status === "closed" ? "Repaid" : "Written off"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isGiven ? "Lent to" : "Borrowed from"} {l.counterparty.name} · {LOAN_TYPES.find((t) => t.value === l.loan_type)?.label} · {METHODS.find((m) => m.value === l.interest_method)?.label}
              {Number(l.interest_rate) > 0 && ` at ${Number(l.interest_rate)}% p.a.`} · since {formatDate(l.start_date)}
            </p>
          </div>
          <div className="flex gap-2">
            {l.status === "active" && (
              <Button onClick={() => setDialog("repay")}>
                <Plus /> {isGiven ? "Record amount received" : "Record repayment"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog("edit")}><Pencil /> Edit terms</DropdownMenuItem>
                {l.status === "active" && l.schedule.length > 1 && (
                  <DropdownMenuItem onSelect={() => setDialog("past")}><CheckCheck /> Mark installments already paid</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setDialog("disburse")}><Plus /> {isGiven ? "Lend more" : "Add top-up / extra disbursement"}</DropdownMenuItem>
                {l.status === "active" ? (
                  <DropdownMenuItem onSelect={() => setStatus.mutate("written_off")}>Mark as written off</DropdownMenuItem>
                ) : l.status === "written_off" ? (
                  <DropdownMenuItem onSelect={() => setStatus.mutate("active")}>Reactivate</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}><Trash2 /> Delete loan</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding principal" value={st.outstanding_principal} hint={`of ${formatMoney(st.disbursed)} ${isGiven ? "lent" : "borrowed"}`} />
        <StatCard label={isGiven ? "Principal received" : "Principal repaid"} value={st.principal_repaid} hint={`${st.repayment_count} payment${st.repayment_count === 1 ? "" : "s"}`} />
        <StatCard label={isGiven ? "Interest received" : "Interest paid"} value={st.interest_paid} hint={Number(st.fees_paid) ? `+ ${formatMoney(st.fees_paid)} fees` : undefined} />
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">{st.next_due_date ? "Next due" : "Completion"}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">
              {st.next_due_date ? <Money value={st.next_due_amount} /> : st.estimated_completion ? formatDate(st.estimated_completion, "MMM yyyy") : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{st.next_due_date ? formatDate(st.next_due_date) : st.estimate_note}</p>
          </CardContent>
        </Card>
      </div>

      {st.overdue_count > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-medium text-destructive">{st.overdue_count} installment{st.overdue_count === 1 ? "" : "s"} overdue</span> — {formatMoney(st.overdue_amount)} past due according to the schedule.
          {l.schedule.length > 1 && (
            <>
              {" "}Paid them before adding this loan?{" "}
              <Button variant="link" size="sm" className="h-auto p-0 align-baseline" onClick={() => setDialog("past")}>
                Mark as already paid
              </Button>
            </>
          )}
        </div>
      )}

      {l.schedule.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Repayment schedule</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Estimated{st.emi ? ` · EMI ${formatMoney(st.emi)}` : ""} · total interest about {formatMoney(st.projected_total_interest)} · {st.installments_covered} of {st.installments_total} covered
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show upcoming" : "Show all"}</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Installment</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((r) => (
                  <TableRow key={r.seq}>
                    <TableCell className="num text-muted-foreground">{r.seq}</TableCell>
                    <TableCell>{formatDate(r.due_date)}</TableCell>
                    <TableCell className="num text-right font-medium">{formatMoney(r.amount)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(r.principal_component)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(r.interest_component)}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{formatMoney(r.closing_principal)}</TableCell>
                    <TableCell><Badge variant={STATUS_STYLE[r.status].variant}>{STATUS_STYLE[r.status].label}</Badge></TableCell>
                  </TableRow>
                ))}
                {schedule.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">All installments are covered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest + fees</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {l.transactions.map((t) => {
                const repayment = t.kind.endsWith("repayment");
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      {t.kind_label}
                      {t.notes && <span className="block max-w-56 truncate text-xs text-muted-foreground">{t.notes}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.account?.name ?? (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAccountFor(t)}>
                          Set account
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="num text-right">{repayment ? formatMoney(t.principal_portion) : "—"}</TableCell>
                    <TableCell className="num text-right">{repayment ? formatMoney(addMoney(t.interest_portion, t.fee_portion)) : "—"}</TableCell>
                    <TableCell className="text-right"><AmountCell t={t} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.kind_label} of ${formatMoney(t.amount)}`} onClick={() => setDeleting(t)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {l.notes && <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">{l.notes}</p>}
        </CardContent>
      </Card>

      <FormDialog open={!!accountFor} onOpenChange={(o) => !o && setAccountFor(null)} title="Set the account">
        {accountFor && <SetAccountForm loan={l} txn={accountFor} onDone={() => setAccountFor(null)} />}
      </FormDialog>
      <FormDialog open={dialog === "repay"} onOpenChange={(o) => !o && setDialog(null)} title={isGiven ? "Record amount received" : "Record repayment"} description={l.name}>
        <RepaymentForm loan={l} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog
        open={dialog === "past"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mark installments already paid"
        description="For a loan that was already running when you added it."
      >
        <PastInstallmentsForm loan={l} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "disburse"} onOpenChange={(o) => !o && setDialog(null)} title={isGiven ? "Lend more" : "Additional disbursement"} description="Increases the outstanding principal.">
        <DisbursementForm loan={l} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} title="Edit loan terms" description="Changing terms regenerates the estimated schedule. Recorded payments are kept." wide>
        <LoanForm direction={l.direction as "taken" | "given"} initial={l} onDone={() => setDialog(null)} />
      </FormDialog>
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Delete ${l.name}?`}
        description="This removes the loan, its schedule and all of its repayments from your balances and reports. A record is kept in the audit log."
        confirmLabel="Delete loan"
        onConfirm={async () => {
          await delLoan.mutateAsync(undefined);
          router.replace(backHref);
        }}
      />
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${deleting.kind_label} of ${formatMoney(deleting.amount)} on ${formatDate(deleting.date)}. The outstanding amount will be recalculated (${formatMoney(subMoney(st.outstanding_principal, "0"))} now).` : ""}
        onConfirm={() => delTxn.mutateAsync(deleting!)}
      />
    </div>
  );
}

function Inner() {
  const id = Number(useSearchParams().get("id"));
  if (!id) return <ErrorState error={new Error("No loan selected")} />;
  return <LoanDetailView id={id} />;
}

export default function LoanViewPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 size-6 animate-spin text-muted-foreground" />}>
      <Inner />
    </Suspense>
  );
}
