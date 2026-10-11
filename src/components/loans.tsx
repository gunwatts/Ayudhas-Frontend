"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, ChevronRight, HandCoins, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingRows, Money, PageHeader, ProgressBar, StatCard } from "@/components/common";
import { AccountSelect, AmountInput, Field, PersonInput, SimpleSelect } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { addMoney, formatMoney, isValidAmount, normalizeAmount, toNumber } from "@/lib/money";
import { type Loan, type LoanDetail, useFinanceMutation, useLoans } from "@/lib/queries";

export type Direction = "taken" | "given";

export const LOAN_TYPES = [
  { value: "personal", label: "Personal" },
  { value: "home", label: "Home" },
  { value: "vehicle", label: "Vehicle" },
  { value: "education", label: "Education" },
  { value: "gold", label: "Gold" },
  { value: "business", label: "Business" },
  { value: "credit_line", label: "Credit line" },
  { value: "informal", label: "Family / friends" },
  { value: "other", label: "Other" },
] as const;

export const METHODS = [
  { value: "none", label: "No interest" },
  { value: "reducing_balance", label: "Reducing balance (EMI)" },
  { value: "flat", label: "Flat rate" },
  { value: "simple_bullet", label: "Simple interest, paid at the end" },
] as const;

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "none", label: "No fixed schedule" },
] as const;

const optionalAmount = z.string().refine((v) => !v.trim() || isValidAmount(v), "Enter a valid amount");

const loanSchema = z
  .object({
    counterparty_name: z.string().trim().min(1, "Who is this loan with?").max(150),
    name: z.string().trim().max(150),
    loan_type: z.string(),
    principal: z.string().refine(isValidAmount, "Enter the amount"),
    start_date: z.string().min(1, "Choose a date"),
    interest_method: z.enum(["none", "reducing_balance", "flat", "simple_bullet"]),
    interest_rate: z.string().refine((v) => !v.trim() || (/^\d{1,3}(\.\d{1,3})?$/.test(v.trim()) && Number(v) <= 100), "Enter a rate between 0 and 100"),
    frequency: z.enum(["monthly", "quarterly", "none"]),
    tenure_months: z.string().refine((v) => !v.trim() || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 600), "1 to 600 months"),
    first_due_date: z.string(),
    emi_override: optionalAmount,
    expected_end_date: z.string(),
    account_id: z.string(),
    notes: z.string().max(5000),
  })
  .superRefine((v, ctx) => {
    if (v.interest_method !== "none" && !Number(v.interest_rate))
      ctx.addIssue({ code: "custom", path: ["interest_rate"], message: "Enter the interest rate" });
    if ((v.interest_method === "reducing_balance" || v.interest_method === "flat") && v.frequency === "none")
      ctx.addIssue({ code: "custom", path: ["frequency"], message: "Installment loans need a frequency" });
    if (v.frequency !== "none" && v.interest_method !== "simple_bullet" && !v.tenure_months.trim() && v.interest_method !== "none")
      ctx.addIssue({ code: "custom", path: ["tenure_months"], message: "Enter the tenure" });
    if (v.frequency === "quarterly" && v.tenure_months && Number(v.tenure_months) % 3 !== 0)
      ctx.addIssue({ code: "custom", path: ["tenure_months"], message: "Quarterly loans need a multiple of 3 months" });
  });
type LoanValues = z.infer<typeof loanSchema>;

/** Display-only EMI estimate; the server computes the authoritative schedule. */
function emiPreview(v: LoanValues): string | null {
  if (v.interest_method !== "reducing_balance" || !isValidAmount(v.principal) || !v.tenure_months) return null;
  const step = v.frequency === "quarterly" ? 3 : 1;
  const n = Number(v.tenure_months) / step;
  const r = (Number(v.interest_rate) / 100 / 12) * step;
  if (!n || !Number.isInteger(n)) return null;
  const p = toNumber(normalizeAmount(v.principal));
  const emi = r === 0 ? p / n : (p * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return formatMoney(emi);
}

export function LoanForm({ direction, initial, onDone }: { direction: Direction; initial?: LoanDetail; onDone: (loan: LoanDetail) => void }) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const isGiven = direction === "given";
  const form = useForm<LoanValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      counterparty_name: initial?.counterparty.name ?? "",
      name: initial?.name ?? "",
      loan_type: initial?.loan_type ?? (isGiven ? "informal" : "personal"),
      principal: initial?.principal ?? "",
      start_date: initial?.start_date ?? today(),
      interest_method: (initial?.interest_method as LoanValues["interest_method"]) ?? (isGiven ? "none" : "reducing_balance"),
      interest_rate: initial ? String(Number(initial.interest_rate)) : "",
      frequency: (initial?.frequency as LoanValues["frequency"]) ?? (isGiven ? "none" : "monthly"),
      tenure_months: initial?.tenure_months ? String(initial.tenure_months) : "",
      first_due_date: initial?.first_due_date ?? "",
      emi_override: initial?.emi_override ?? "",
      expected_end_date: initial?.expected_end_date ?? "",
      account_id: "",
      notes: initial?.notes ?? "",
    },
  });
  const v = useWatch({ control: form.control }) as LoanValues;
  const preview = emiPreview(v);
  const save = useFinanceMutation(
    (values: LoanValues) => {
      const body = {
        name: values.name.trim() || `${values.counterparty_name.trim()} ${isGiven ? "(lent)" : "loan"}`,
        loan_type: values.loan_type,
        principal: normalizeAmount(values.principal),
        start_date: values.start_date,
        interest_method: values.interest_method,
        interest_rate: values.interest_method === "none" ? "0" : values.interest_rate.trim() || "0",
        frequency: values.frequency,
        tenure_months: values.tenure_months ? Number(values.tenure_months) : null,
        first_due_date: values.first_due_date || null,
        emi_override: values.emi_override.trim() ? normalizeAmount(values.emi_override) : null,
        expected_end_date: values.expected_end_date || null,
        notes: values.notes,
      };
      if (initial) return api.patch<LoanDetail>(`/loans/${initial.id}`, body);
      return api.post<LoanDetail>(
        "/loans",
        { ...body, direction, counterparty_name: values.counterparty_name.trim(), account_id: values.account_id ? Number(values.account_id) : null },
        key,
      );
    },
    { success: initial ? "Loan updated" : "Loan recorded", silentError: true },
  );
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      onDone(await save.mutateAsync(values));
    } catch (e) {
      setError(applyFieldErrors(e, form.setError as never, Object.keys(values)));
    }
  });
  const e = form.formState.errors;
  const method = v.interest_method;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isGiven ? "Lent to" : "Lender"} required error={e.counterparty_name?.message}>
          {({ id, invalid }) => (
            <Controller
              control={form.control}
              name="counterparty_name"
              render={({ field }) => <PersonInput id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder={isGiven ? "e.g. Ravi" : "e.g. HDFC Bank or Dad"} />}
            />
          )}
        </Field>
        <Field label="Label" hint="Optional, e.g. “Car loan”">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} {...form.register("name")} />}
        </Field>
        <Field label={isGiven ? "Amount lent" : "Amount borrowed"} required error={e.principal?.message}>
          {({ id, invalid }) => <AmountInput id={id} aria-invalid={invalid} {...form.register("principal")} />}
        </Field>
        <Field label={isGiven ? "Date lent" : "Disbursed on"} required error={e.start_date?.message}>
          {({ id }) => <Input id={id} type="date" {...form.register("start_date")} />}
        </Field>
        <Field label="Loan type">
          {({ id }) => <Controller control={form.control} name="loan_type" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={LOAN_TYPES} />} />}
        </Field>
        <Field label="Interest">
          {({ id }) => <Controller control={form.control} name="interest_method" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={METHODS} />} />}
        </Field>
        {method !== "none" && (
          <Field label="Annual interest rate (%)" required error={e.interest_rate?.message}>
            {({ id, invalid }) => <Input id={id} inputMode="decimal" aria-invalid={invalid} placeholder="e.g. 10.5" {...form.register("interest_rate")} />}
          </Field>
        )}
        {method !== "simple_bullet" && (
          <Field label="Repayment schedule" error={e.frequency?.message}>
            {({ id, invalid }) => (
              <Controller control={form.control} name="frequency" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} invalid={invalid} options={FREQUENCIES} />} />
            )}
          </Field>
        )}
        {(v.frequency !== "none" || method === "simple_bullet") && (
          <Field label="Tenure (months)" error={e.tenure_months?.message}>
            {({ id, invalid }) => <Input id={id} inputMode="numeric" aria-invalid={invalid} placeholder="e.g. 36" {...form.register("tenure_months")} />}
          </Field>
        )}
        {v.frequency !== "none" && method !== "simple_bullet" && (
          <Field label="First installment due" hint="Defaults to one period after the start date">
            {({ id, describedBy }) => <Input id={id} type="date" aria-describedby={describedBy} {...form.register("first_due_date")} />}
          </Field>
        )}
        {method === "reducing_balance" && (
          <Field label="Lender's EMI (optional)" error={e.emi_override?.message} hint="Use the exact EMI from your loan statement if it differs from our estimate.">
            {({ id, invalid, describedBy }) => <AmountInput id={id} aria-invalid={invalid} aria-describedby={describedBy} {...form.register("emi_override")} />}
          </Field>
        )}
        {(v.frequency === "none" || method === "simple_bullet") && (
          <Field label="Expected repayment date" hint="Optional">
            {({ id, describedBy }) => <Input id={id} type="date" aria-describedby={describedBy} {...form.register("expected_end_date")} />}
          </Field>
        )}
        {!initial && (
          <Field label={isGiven ? "Paid from account" : "Received into account"} hint="Leave empty if the money didn't pass through your accounts (e.g. paid directly to a seller).">
            {({ id, describedBy }) => (
              <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} describedBy={describedBy} />} />
            )}
          </Field>
        )}
      </div>
      {preview && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Estimated EMI: <span className="num font-semibold">{preview}</span>
          <span className="text-muted-foreground"> — your lender&apos;s figure may differ slightly because of rounding and day counts.</span>
        </p>
      )}
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : initial ? "Save changes" : isGiven ? "Record money lent" : "Add loan"}
        </Button>
      </div>
    </form>
  );
}

export function LoanCard({ loan }: { loan: Loan }) {
  const st = loan.state;
  const paidPct = toNumber(st.disbursed) > 0 ? (toNumber(st.principal_repaid) / toNumber(st.disbursed)) * 100 : 0;
  const closed = loan.status !== "active";
  return (
    <Link href={`/loans/view/?id=${loan.id}`} className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className={`transition-colors group-hover:border-primary/40 ${closed ? "opacity-70" : ""}`}>
        <CardContent className="grid gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{loan.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {loan.counterparty.name} · {LOAN_TYPES.find((t) => t.value === loan.loan_type)?.label}
                {Number(loan.interest_rate) > 0 && ` · ${Number(loan.interest_rate)}%`}
              </p>
            </div>
            {loan.status === "closed" ? (
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Repaid</Badge>
            ) : loan.status === "written_off" ? (
              <Badge variant="secondary">Written off</Badge>
            ) : st.overdue_count > 0 ? (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Overdue</Badge>
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-semibold tracking-tight">
              <Money value={st.outstanding_principal} />
            </p>
          </div>
          <ProgressBar value={paidPct} tone={closed ? "positive" : "primary"} label={`${paidPct.toFixed(0)}% repaid`} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatMoney(st.principal_repaid)} of {formatMoney(st.disbursed)} repaid
            </span>
            <span>{st.next_due_date ? `Next: ${formatDate(st.next_due_date, "d MMM")} · ${formatMoney(st.next_due_amount)}` : st.estimate_note}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function LoansPage({ direction }: { direction: Direction }) {
  const loans = useLoans(direction);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const isGiven = direction === "given";
  const active = loans.data?.filter((l) => l.status === "active") ?? [];
  const done = loans.data?.filter((l) => l.status !== "active") ?? [];
  const outstanding = addMoney(...active.map((l) => l.state.outstanding_principal));
  const overdue = addMoney(...active.map((l) => l.state.overdue_amount));
  const interest = addMoney(...(loans.data ?? []).map((l) => l.state.interest_paid));

  return (
    <>
      <PageHeader
        title={isGiven ? "Money lent" : "Loans taken"}
        description={isGiven ? "Money you gave to others that should come back. Gifts are expenses, not loans." : "Money you borrowed from banks, family or friends."}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {isGiven ? "Record money lent" : "Add loan"}
          </Button>
        }
      />
      {loans.error && !loans.data ? (
        <ErrorState error={loans.error} onRetry={() => loans.refetch()} />
      ) : loans.isPending ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label={isGiven ? "Owed to you" : "You owe"} value={outstanding} />
            <StatCard label="Overdue" value={overdue} hint={toNumber(overdue) > 0 ? "Installments past due" : "Nothing overdue"} />
            <StatCard label={isGiven ? "Interest received" : "Interest paid"} value={interest} />
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="mt-1.5 text-2xl font-semibold">{active.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">{done.length} closed</p>
              </CardContent>
            </Card>
          </div>
          {!loans.data?.length ? (
            <EmptyState
              icon={isGiven ? HandCoins : Landmark}
              title={isGiven ? "No money lent" : "No loans"}
              description={isGiven ? "Record money you lend to family or friends and track repayments." : "Add bank or personal loans to track EMIs, interest and what you still owe."}
              action={<Button onClick={() => setCreating(true)}><Plus /> {isGiven ? "Record money lent" : "Add loan"}</Button>}
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((l) => <LoanCard key={l.id} loan={l} />)}
              </div>
              {done.length > 0 && (
                <div>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">Closed</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {done.map((l) => <LoanCard key={l.id} loan={l} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title={isGiven ? "Record money lent" : "Add a loan"} wide>
        <LoanForm direction={direction} onDone={(loan) => { setCreating(false); router.push(`/loans/view/?id=${loan.id}`); }} />
      </FormDialog>
    </>
  );
}
