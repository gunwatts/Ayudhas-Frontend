"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AccountSelect, AmountInput, Field } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { today } from "@/lib/dates";
import { formatMoney, isValidAmount, normalizeAmount, toPaise } from "@/lib/money";
import { useFinanceMutation } from "@/lib/queries";

type Values = { amount: string; date: string; account_id: string; notes: string; principal_portion: string };

/** Amount + date + account form for custody deposits/returns and investment contributions/withdrawals. */
export function MoveForm({
  endpoint,
  accountLabel,
  submitLabel,
  success,
  max,
  costBasis,
  onDone,
}: {
  endpoint: string;
  accountLabel: string;
  submitLabel: string;
  success: string;
  /** Client-side guard (the server enforces it too). */
  max?: string;
  /** Show the cost-basis field (investment withdrawals). */
  costBasis?: { invested: string };
  onDone: () => void;
}) {
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ defaultValues: { amount: "", date: today(), account_id: "", notes: "", principal_portion: "" } });
  const save = useFinanceMutation(
    (v: Values) =>
      api.post(
        endpoint,
        {
          amount: normalizeAmount(v.amount),
          date: v.date,
          account_id: v.account_id ? Number(v.account_id) : null,
          notes: v.notes,
          ...(costBasis ? { principal_portion: v.principal_portion.trim() ? normalizeAmount(v.principal_portion) : null } : {}),
        },
        key,
      ),
    { success, silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!isValidAmount(v.amount)) return form.setError("amount", { message: "Enter an amount greater than 0" });
        if (max && toPaise(v.amount) > toPaise(max)) return form.setError("amount", { message: `Cannot exceed ${formatMoney(max)}` });
        if (costBasis && v.principal_portion.trim() && !/^\d{1,12}(\.\d{1,2})?$/.test(v.principal_portion.trim()))
          return form.setError("principal_portion", { message: "Enter a valid amount" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["amount", "date", "principal_portion"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required error={e.amount?.message} hint={max ? `Up to ${formatMoney(max)}` : undefined}>
          {({ id, invalid, describedBy }) => <AmountInput id={id} autoFocus aria-invalid={invalid} aria-describedby={describedBy} {...form.register("amount")} />}
        </Field>
        <Field label="Date">{({ id }) => <Input id={id} type="date" {...form.register("date")} />}</Field>
        <Field label={accountLabel} className="sm:col-span-2">
          {({ id }) => <Controller control={form.control} name="account_id" render={({ field }) => <AccountSelect id={id} value={field.value} onChange={field.onChange} />} />}
        </Field>
        {costBasis && (
          <Field
            label="Cost of the units withdrawn"
            error={e.principal_portion?.message}
            className="sm:col-span-2"
            hint={`How much of your invested ${formatMoney(costBasis.invested)} this withdrawal returns. Leave empty to count it as principal first (up to what you invested); anything above that is a gain.`}
          >
            {({ id, describedBy, invalid }) => <AmountInput id={id} aria-invalid={invalid} aria-describedby={describedBy} {...form.register("principal_portion")} />}
          </Field>
        )}
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
