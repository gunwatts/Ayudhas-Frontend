"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Field, SimpleSelect } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { type InvestmentDetail, useFinanceMutation } from "@/lib/queries";

export const INVESTMENT_TYPES = [
  { value: "fd", label: "Fixed deposit" },
  { value: "rd", label: "Recurring deposit" },
  { value: "mutual_fund", label: "Mutual fund" },
  { value: "stock", label: "Stocks" },
  { value: "bond", label: "Bonds" },
  { value: "gold", label: "Gold" },
  { value: "pf", label: "Provident fund / retirement" },
  { value: "other", label: "Other" },
] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name the investment").max(150),
  type: z.enum(["fd", "rd", "mutual_fund", "stock", "bond", "gold", "pf", "other"]),
  institution: z.string().max(255),
  opened_on: z.string(),
  maturity_date: z.string(),
  expected_rate: z.string().refine((v) => !v.trim() || (/^\d{1,3}(\.\d{1,3})?$/.test(v.trim()) && Number(v) <= 100), "0 to 100"),
  notes: z.string().max(5000),
});
type Values = z.infer<typeof schema>;

export function InvestmentForm({ initial, onDone }: { initial?: InvestmentDetail; onDone: (i: InvestmentDetail) => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type as Values["type"]) ?? "mutual_fund",
      institution: initial?.institution ?? "",
      opened_on: initial?.opened_on ?? "",
      maturity_date: initial?.maturity_date ?? "",
      expected_rate: initial?.expected_rate ? String(Number(initial.expected_rate)) : "",
      notes: initial?.notes ?? "",
    },
  });
  const save = useFinanceMutation(
    (v: Values) => {
      const body = { ...v, opened_on: v.opened_on || null, maturity_date: v.maturity_date || null, expected_rate: v.expected_rate.trim() || null };
      return initial ? api.patch<InvestmentDetail>(`/investments/${initial.id}`, body) : api.post<InvestmentDetail>("/investments", body);
    },
    { success: initial ? "Investment updated" : "Investment added", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        try {
          onDone(await save.mutateAsync(v));
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, Object.keys(v)));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={e.name?.message}>
          {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. Nifty 50 index fund" {...form.register("name")} />}
        </Field>
        <Field label="Type">
          {({ id }) => <Controller control={form.control} name="type" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={INVESTMENT_TYPES} />} />}
        </Field>
        <Field label="Institution / platform">{({ id }) => <Input id={id} {...form.register("institution")} />}</Field>
        <Field label="Expected return (% p.a.)" error={e.expected_rate?.message} hint="For FDs/RDs; informational only">
          {({ id, describedBy }) => <Input id={id} inputMode="decimal" aria-describedby={describedBy} {...form.register("expected_rate")} />}
        </Field>
        <Field label="Opened on">{({ id }) => <Input id={id} type="date" {...form.register("opened_on")} />}</Field>
        <Field label="Maturity date">{({ id }) => <Input id={id} type="date" {...form.register("maturity_date")} />}</Field>
      </div>
      <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} {...form.register("notes")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Add investment"}</Button>
      </div>
    </form>
  );
}
