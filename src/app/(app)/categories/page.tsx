"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ConfirmAction, ErrorState, LoadingRows, PageHeader } from "@/components/common";
import { Field, NONE } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, applyFieldErrors } from "@/lib/api";
import { type Category, useCategories, useFinanceMutation } from "@/lib/queries";

type Kind = "expense" | "income";

function CategoryForm({ kind, initial, parents, onDone }: { kind: Kind; initial?: Category; parents: Category[]; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { name: initial?.name ?? "", parent_id: initial?.parent_id ? String(initial.parent_id) : "", color: initial?.color || "#2a78d6" } });
  const save = useFinanceMutation(
    (v: { name: string; parent_id: string; color: string }) => {
      const body = { name: v.name.trim(), parent_id: v.parent_id ? Number(v.parent_id) : null, color: v.color };
      return initial ? api.patch(`/categories/${initial.id}`, body) : api.post("/categories", { ...body, kind });
    },
    { success: initial ? "Category updated" : "Category added", silentError: true },
  );
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!v.name.trim()) return form.setError("name", { message: "Enter a name" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["name", "parent_id"]));
        }
      })}
    >
      <Field label="Name" required error={form.formState.errors.name?.message}>{({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid} {...form.register("name")} />}</Field>
      <Field label="Parent category" error={form.formState.errors.parent_id?.message} hint="Optional — makes this a subcategory">
        {({ id, describedBy }) => (
          <Controller
            control={form.control}
            name="parent_id"
            render={({ field }) => (
              <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                <SelectTrigger id={id} aria-describedby={describedBy} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (top level)</SelectItem>
                  {parents.filter((p) => p.id !== initial?.id).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Colour">{({ id }) => <Input id={id} type="color" className="h-9 w-20 p-1" {...form.register("color")} />}</Field>
      <FormError message={error} />
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save" : "Add category"}</Button></div>
    </form>
  );
}

function Row({ c, onEdit, indent }: { c: Category; onEdit: () => void; indent?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const archive = useFinanceMutation(() => api.patch(`/categories/${c.id}`, { is_archived: !c.is_archived }), { success: c.is_archived ? "Category restored" : "Category archived" });
  const del = useFinanceMutation(() => api.delete(`/categories/${c.id}`), { success: "Category deleted" });
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${indent ? "pl-10" : ""} ${c.is_archived ? "opacity-60" : ""}`}>
      <span className="chart-swatch size-3 rounded-full border" style={{ background: c.color || "transparent" }} aria-hidden />
      <span className="flex-1 truncate text-sm">{c.name}</span>
      {c.is_archived && <Badge variant="secondary">Archived</Badge>}
      <span className="text-xs text-muted-foreground">{c.usage_count} txn{c.usage_count === 1 ? "" : "s"}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => archive.mutate(undefined)}>{c.is_archived ? <ArchiveRestore /> : <Archive />} {c.is_archived ? "Restore" : "Archive"}</DropdownMenuItem>
          {c.usage_count === 0 && !c.is_system && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title={`Delete “${c.name}”?`} description="It has no transactions, so nothing else changes." onConfirm={() => del.mutateAsync(undefined)} />
    </li>
  );
}

export default function CategoriesPage() {
  const [kind, setKind] = useState<Kind>("expense");
  const q = useCategories(kind, true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const all = q.data ?? [];
  const parents = all.filter((c) => !c.parent_id);
  return (
    <>
      <PageHeader title="Categories" description="Organise income and spending. Archived categories keep their history." actions={<Button onClick={() => setCreating(true)}><Plus /> Add category</Button>} />
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList className="mb-4"><TabsTrigger value="expense">Expense</TabsTrigger><TabsTrigger value="income">Income</TabsTrigger></TabsList>
      </Tabs>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <LoadingRows rows={6} />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <ul className="divide-y">
              {parents.map((p) => (
                <li key={p.id}>
                  <ul className="divide-y">
                    <Row c={p} onEdit={() => setEditing(p)} />
                    {all.filter((c) => c.parent_id === p.id).map((c) => <Row key={c.id} c={c} indent onEdit={() => setEditing(c)} />)}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title={`New ${kind} category`}><CategoryForm kind={kind} parents={parents.filter((p) => !p.is_archived)} onDone={() => setCreating(false)} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit category">{editing && <CategoryForm kind={kind} initial={editing} parents={parents} onDone={() => setEditing(null)} />}</FormDialog>
    </>
  );
}
