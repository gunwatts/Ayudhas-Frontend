"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Field, SimpleSelect } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, applyFieldErrors } from "@/lib/api";
import { type Business, type Project, useFinanceMutation } from "@/lib/queries";

export const BUSINESS_CATEGORIES = [
  { value: "retail", label: "Retail / shop" },
  { value: "services", label: "Services" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "construction", label: "Construction / contracting" },
  { value: "food", label: "Food & catering" },
  { value: "agriculture", label: "Agriculture" },
  { value: "trading", label: "Trading" },
  { value: "other", label: "Other" },
] as const;

export const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;

export const categoryLabel = (v: string) => BUSINESS_CATEGORIES.find((c) => c.value === v)?.label ?? "Other";
export const statusLabel = (v: string) => PROJECT_STATUSES.find((c) => c.value === v)?.label ?? v;

type BusinessValues = { name: string; category: string; description: string; gstin: string };

export function BusinessForm({ initial, onDone }: { initial?: Business; onDone: (b: Business) => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<BusinessValues>({
    defaultValues: { name: initial?.name ?? "", category: initial?.category ?? "other", description: initial?.description ?? "", gstin: initial?.gstin ?? "" },
  });
  const save = useFinanceMutation(
    (v: BusinessValues) => {
      const body = { name: v.name.trim(), category: v.category, description: v.description.trim(), gstin: v.gstin.trim().toUpperCase() };
      return initial ? api.patch<Business>(`/businesses/${initial.id}`, body) : api.post<Business>("/businesses", body);
    },
    { success: initial ? "Business updated" : "Business added", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!v.name.trim()) return form.setError("name", { message: "Give the business a name" });
        if (v.gstin.trim() && !/^[0-9A-Za-z]{1,20}$/.test(v.gstin.trim())) return form.setError("gstin", { message: "Letters and digits only" });
        setError(null);
        try {
          onDone(await save.mutateAsync(v));
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "category", "description", "gstin"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required error={e.name?.message}>
          {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. Sri Interiors" {...form.register("name")} />}
        </Field>
        <Field label="Type of business">
          {({ id }) => <Controller control={form.control} name="category" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={BUSINESS_CATEGORIES} />} />}
        </Field>
        <Field label="GSTIN" error={e.gstin?.message} hint="Optional">
          {({ id, invalid, describedBy }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} maxLength={20} {...form.register("gstin")} />}
        </Field>
      </div>
      <Field label="Description" hint="Optional: what you sell or do, where you work.">
        {({ id, describedBy }) => <Textarea id={id} rows={2} aria-describedby={describedBy} {...form.register("description")} />}
      </Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Add business"}</Button>
      </div>
    </form>
  );
}

type ProjectValues = { name: string; client: string; description: string; status: string; start_date: string; end_date: string };

export function ProjectForm({ businessId, initial, onDone }: { businessId: number; initial?: Project; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProjectValues>({
    defaultValues: {
      name: initial?.name ?? "",
      client: initial?.client ?? "",
      description: initial?.description ?? "",
      status: initial?.status ?? "active",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
    },
  });
  const save = useFinanceMutation(
    (v: ProjectValues) => {
      const body = {
        name: v.name.trim(),
        client: v.client.trim(),
        description: v.description.trim(),
        status: v.status,
        start_date: v.start_date || null,
        end_date: v.end_date || null,
      };
      return initial ? api.patch(`/projects/${initial.id}`, body) : api.post(`/businesses/${businessId}/projects`, body);
    },
    { success: initial ? "Project updated" : "Project added", silentError: true },
  );
  const e = form.formState.errors;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!v.name.trim()) return form.setError("name", { message: "Give the project a name" });
        if (v.start_date && v.end_date && v.end_date < v.start_date) return form.setError("end_date", { message: "End date must be on or after the start date" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "client", "status", "start_date", "end_date"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" required error={e.name?.message}>
          {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} placeholder="e.g. Villa 12 interiors" {...form.register("name")} />}
        </Field>
        <Field label="Client" hint="Optional">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} {...form.register("client")} />}
        </Field>
        <Field label="Status">
          {({ id }) => <Controller control={form.control} name="status" render={({ field }) => <SimpleSelect id={id} value={field.value} onChange={field.onChange} options={PROJECT_STATUSES} />} />}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts">{({ id }) => <Input id={id} type="date" {...form.register("start_date")} />}</Field>
          <Field label="Ends" error={e.end_date?.message}>{({ id }) => <Input id={id} type="date" {...form.register("end_date")} />}</Field>
        </div>
      </div>
      <Field label="Description" hint="Optional">
        {({ id, describedBy }) => <Textarea id={id} rows={2} aria-describedby={describedBy} {...form.register("description")} />}
      </Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Add project"}</Button>
      </div>
    </form>
  );
}
