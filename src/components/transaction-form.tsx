"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { AccountSelect, AmountInput, BusinessSelect, CategorySelect, EventInput, Field, NONE, PersonSelect, ProjectSelect, SimpleSelect } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { today } from "@/lib/dates";
import { isValidAmount, normalizeAmount } from "@/lib/money";
import { type Txn, useBusinesses, useFinanceMutation } from "@/lib/queries";

export const GENERIC_KINDS = ["expense", "income", "transfer", "refund", "adjustment_in", "adjustment_out"] as const;
export type GenericKind = (typeof GENERIC_KINDS)[number];

const KIND_LABEL: Record<GenericKind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  refund: "Refund",
  adjustment_in: "Adjustment (+)",
  adjustment_out: "Adjustment (−)",
};

const PAYMENT_METHODS = [
  { value: NONE, label: "Not specified" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit card" },
  { value: "credit_card", label: "Credit card" },
  { value: "net_banking", label: "Net banking" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

const schema = z
  .object({
    kind: z.enum(GENERIC_KINDS),
    amount: z.string().refine(isValidAmount, "Enter an amount greater than 0 with at most 2 decimals"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().optional(),
    account_id: z.string(),
    to_account_id: z.string(),
    category_id: z.string(),
    counterparty_id: z.string(),
    event_name: z.string().max(150, "Keep the event name under 150 characters"),
    business_id: z.string(),
    project_id: z.string(),
    description: z.string().max(255, "Keep it under 255 characters"),
    merchant: z.string().max(150),
    payment_method: z.string(),
    notes: z.string().max(5000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.account_id) ctx.addIssue({ code: "custom", path: ["account_id"], message: "Choose the source account" });
      if (!v.to_account_id) ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Choose the destination account" });
      if (v.account_id && v.account_id === v.to_account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Choose a different account" });
    }
    if ((v.kind === "adjustment_in" || v.kind === "adjustment_out") && !v.account_id)
      ctx.addIssue({ code: "custom", path: ["account_id"], message: "Adjustments need an account" });
  });

type Values = z.infer<typeof schema>;
const FIELDS = ["kind", "amount", "date", "time", "account_id", "to_account_id", "category_id", "counterparty_id", "event_name", "business_id", "project_id", "description", "merchant", "payment_method", "notes"] as const;

function toBody(v: Values) {
  const id = (s: string) => (s ? Number(s) : null);
  const isSpend = v.kind === "expense" || v.kind === "refund";
  return {
    kind: v.kind,
    amount: normalizeAmount(v.amount),
    date: v.date,
    time: v.time ? v.time : null,
    account_id: id(v.account_id),
    to_account_id: v.kind === "transfer" ? id(v.to_account_id) : null,
    category_id: v.kind === "income" || isSpend ? id(v.category_id) : null,
    // Who it was for (an expense) or from (income); shows in People and their groups.
    counterparty_id: v.kind === "income" || isSpend ? id(v.counterparty_id) : null,
    // Matched to an existing event by name (any case) or created by the server; "" removes the link.
    event_name: isSpend ? v.event_name.trim() : "",
    // Business money stays out of personal totals; only income, expenses and refunds can belong to a business.
    business_id: v.kind === "income" || isSpend ? id(v.business_id) : null,
    project_id: (v.kind === "income" || isSpend) && v.business_id ? id(v.project_id) : null,
    description: v.description.trim(),
    merchant: isSpend ? v.merchant.trim() : "",
    payment_method: v.payment_method === NONE ? "" : v.payment_method,
    notes: v.notes.trim(),
  };
}

export function TransactionForm({
  initial,
  defaultKind = "expense",
  defaultEventName = "",
  defaultBusinessId,
  defaultProjectId,
  onDone,
}: {
  initial?: Txn;
  defaultKind?: GenericKind;
  /** Pre-fill the event (e.g. "Add expense" on an event card). */
  defaultEventName?: string;
  /** Pre-fill the business (and project), e.g. "Add expense" on a business page. */
  defaultBusinessId?: number;
  defaultProjectId?: number;
  onDone: (txn: Txn) => void;
}) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(!!initial && (["refund", "adjustment_in", "adjustment_out"] as string[]).includes(initial.kind));

  const defaults = useMemo<Values>(
    () => ({
      kind: (initial?.kind as GenericKind) ?? defaultKind,
      amount: initial?.amount ?? "",
      date: initial?.date ?? today(),
      time: initial?.time?.slice(0, 5) ?? "",
      account_id: initial?.account ? String(initial.account.id) : "",
      to_account_id: initial?.to_account ? String(initial.to_account.id) : "",
      category_id: initial?.category ? String(initial.category.id) : "",
      counterparty_id: initial?.counterparty ? String(initial.counterparty.id) : "",
      event_name: initial?.event?.name ?? defaultEventName,
      business_id: initial ? (initial.business ? String(initial.business.id) : "") : defaultBusinessId ? String(defaultBusinessId) : "",
      project_id: initial ? (initial.project ? String(initial.project.id) : "") : defaultProjectId ? String(defaultProjectId) : "",
      description: initial?.description ?? "",
      merchant: initial?.merchant ?? "",
      payment_method: initial?.payment_method || NONE,
      notes: initial?.notes ?? "",
    }),
    [initial, defaultKind, defaultEventName, defaultBusinessId, defaultProjectId],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { register, control, handleSubmit, setError, setValue, formState } = form;
  const kind = useWatch({ control, name: "kind" });
  const businessId = useWatch({ control, name: "business_id" });
  const isSpend = kind === "expense" || kind === "refund";
  const businesses = useBusinesses();
  const showBusiness = (kind === "income" || isSpend) && (!!businesses.data?.some((b) => !b.is_archived) || !!initial?.business);

  const mutation = useFinanceMutation(
    (values: Values) =>
      initial
        ? api.patch<Txn>(`/transactions/${initial.id}`, { version: initial.version, ...toBody(values) })
        : api.post<Txn>("/transactions", toBody(values), idempotencyKey),
    { success: initial ? "Transaction updated" : "Transaction saved", silentError: true },
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const txn = await mutation.mutateAsync(values);
      onDone(txn);
    } catch (error) {
      setFormError(applyFieldErrors(error, setError as never, FIELDS));
    }
  });

  // An existing transaction can't be turned into a balance adjustment (adjustments are undone, never edited).
  const kindTabs: GenericKind[] = showMore
    ? GENERIC_KINDS.filter((k) => !initial || !k.startsWith("adjustment"))
    : ["expense", "income", "transfer"];

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <Tabs
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              setValue("category_id", "");
            }}
          >
            <TabsList className="flex h-auto w-full flex-wrap" aria-label="Transaction type">
              {kindTabs.map((k) => (
                <TabsTrigger key={k} value={k} className="flex-1" disabled={!!initial && initial.kind !== k && !(GENERIC_KINDS as readonly string[]).includes(k)}>
                  {KIND_LABEL[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      />
      {!showMore && (
        <button type="button" className="-mt-2 justify-self-start text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowMore(true)}>
          {initial ? "Refund?" : "Refund or balance adjustment?"}
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required error={formState.errors.amount?.message}>
          {({ id, describedBy, invalid }) => (
            <AmountInput id={id} autoFocus aria-describedby={describedBy} aria-invalid={invalid} {...register("amount")} />
          )}
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Date" required error={formState.errors.date?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid} {...register("date")} />
            )}
          </Field>
          <Field label="Time" error={formState.errors.time?.message}>
            {({ id }) => <Input id={id} type="time" className="w-28" {...register("time")} />}
          </Field>
        </div>

        <Field
          label={kind === "transfer" ? "From account" : kind === "income" || kind === "refund" || kind === "adjustment_in" ? "Into account" : "Paid from"}
          required={kind === "transfer" || kind.startsWith("adjustment")}
          error={formState.errors.account_id?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Controller
              control={control}
              name="account_id"
              render={({ field }) => (
                <AccountSelect
                  id={id}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={invalid}
                  describedBy={describedBy}
                  allowNone={kind !== "transfer" && !kind.startsWith("adjustment")}
                />
              )}
            />
          )}
        </Field>

        {kind === "transfer" ? (
          <Field label="To account" required error={formState.errors.to_account_id?.message}>
            {({ id, describedBy, invalid }) => (
              <Controller
                control={control}
                name="to_account_id"
                render={({ field }) => (
                  <AccountSelect id={id} value={field.value} onChange={field.onChange} invalid={invalid} describedBy={describedBy} allowNone={false} />
                )}
              />
            )}
          </Field>
        ) : kind === "income" || isSpend ? (
          <Field label="Category" error={formState.errors.category_id?.message}>
            {({ id, describedBy, invalid }) => (
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <CategorySelect id={id} kind={kind === "income" ? "income" : "expense"} value={field.value} onChange={field.onChange} invalid={invalid} describedBy={describedBy} />
                )}
              />
            )}
          </Field>
        ) : (
          <div />
        )}

        {(kind === "income" || isSpend) && (
          <Field
            label={kind === "income" ? "From person" : "For person"}
            hint={kind === "income" ? "Optional: who gave this money (e.g. dad paying for your brother's things)." : "Optional: who this was for (e.g. things bought for your brother)."}
            error={formState.errors.counterparty_id?.message}
          >
            {({ id, describedBy, invalid }) => (
              <Controller
                control={control}
                name="counterparty_id"
                render={({ field }) => <PersonSelect id={id} value={field.value} onChange={field.onChange} invalid={invalid} describedBy={describedBy} />}
              />
            )}
          </Field>
        )}

        {showBusiness && (
          <>
            <Field label="For" hint="Business income and costs are kept out of your personal totals." error={formState.errors.business_id?.message}>
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={control}
                  name="business_id"
                  render={({ field }) => (
                    <BusinessSelect
                      id={id}
                      value={field.value}
                      invalid={invalid}
                      describedBy={describedBy}
                      onChange={(v) => {
                        field.onChange(v);
                        setValue("project_id", "");
                      }}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Project" error={formState.errors.project_id?.message}>
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={control}
                  name="project_id"
                  render={({ field }) => <ProjectSelect id={id} businessId={businessId} value={field.value} onChange={field.onChange} invalid={invalid} describedBy={describedBy} />}
                />
              )}
            </Field>
          </>
        )}

        <Field label="Description" error={formState.errors.description?.message} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} placeholder={kind === "income" ? "e.g. October salary" : "e.g. Groceries for the week"} {...register("description")} />
          )}
        </Field>

        {isSpend && (
          <>
            <Field label="Merchant / payee" error={formState.errors.merchant?.message}>
              {({ id }) => <Input id={id} placeholder="Optional" {...register("merchant")} />}
            </Field>
            <Field label="Payment method">
              {({ id }) => (
                <Controller
                  control={control}
                  name="payment_method"
                  render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={PAYMENT_METHODS} />}
                />
              )}
            </Field>
            <Field
              label="Event"
              hint="Optional. Groups this expense with others for an occasion, like a wedding or a trip. Pick one or type a new name. It still counts in this month's spending."
              error={formState.errors.event_name?.message}
              className="sm:col-span-2"
            >
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={control}
                  name="event_name"
                  render={({ field }) => <EventInput id={id} value={field.value} onChange={field.onChange} invalid={invalid} describedBy={describedBy} />}
                />
              )}
            </Field>
          </>
        )}

        <Field label="Notes" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={2} placeholder="Optional" {...register("notes")} />}
        </Field>
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : initial ? "Save changes" : `Add ${KIND_LABEL[kind].toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
