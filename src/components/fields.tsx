"use client";

import { useEffect, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useBudgets, useBusinesses, useCategories, usePeople, useProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const NONE = "__none__";

export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AmountInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">₹</span>
      <Input inputMode="decimal" autoComplete="off" placeholder="0.00" {...props} className={cn("num pl-6", props.className)} />
    </div>
  );
}

type SelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
};

export function AccountSelect({ allowNone = true, noneLabel = "No account (not tracked)", ...p }: SelectProps & { allowNone?: boolean; noneLabel?: string }) {
  const { data = [] } = useAccounts();
  return (
    <Select value={p.value || NONE} onValueChange={(v) => p.onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} className="w-full">
        <SelectValue placeholder={p.placeholder ?? "Choose account"} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {data.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({ kind, ...p }: SelectProps & { kind: "expense" | "income" }) {
  const { data = [] } = useCategories(kind);
  const parents = data.filter((c) => !c.parent_id);
  return (
    <Select value={p.value || NONE} onValueChange={(v) => p.onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} className="w-full">
        <SelectValue placeholder="Choose category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Uncategorized</SelectItem>
        {parents.map((parent) => {
          const children = data.filter((c) => c.parent_id === parent.id);
          if (!children.length)
            return (
              <SelectItem key={parent.id} value={String(parent.id)}>
                {parent.name}
              </SelectItem>
            );
          return (
            <SelectGroup key={parent.id}>
              <SelectLabel>{parent.name}</SelectLabel>
              <SelectItem value={String(parent.id)}>{parent.name} (general)</SelectItem>
              {children.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="pl-6">
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Free-text person name with suggestions; the API matches existing people case-insensitively. */
export function PersonInput({ id, value, onChange, invalid, describedBy, placeholder }: SelectProps) {
  const { data = [] } = usePeople();
  const listId = `${id}-people`;
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={placeholder ?? "Name"}
        autoComplete="off"
      />
      <datalist id={listId}>
        {data.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </>
  );
}

/** Free-text event name with suggestions; the API links an existing event (any case) or creates a new one. */
export function EventInput({ id, value, onChange, invalid, describedBy }: SelectProps) {
  const { data = [] } = useBudgets("event");
  const listId = `${id}-events`;
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder="None, or e.g. Sister's wedding"
        autoComplete="off"
      />
      <datalist id={listId}>
        {data.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
    </>
  );
}

export function SimpleSelect({
  options,
  ...p
}: SelectProps & { options: readonly { value: string; label: string }[] }) {
  return (
    <Select value={p.value} onValueChange={p.onChange}>
      <SelectTrigger id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} className="w-full">
        <SelectValue placeholder={p.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Personal money or one of the user's (non-archived) businesses. "" = personal. */
export function BusinessSelect({ allowPersonal = true, ...p }: SelectProps & { allowPersonal?: boolean }) {
  const { data = [] } = useBusinesses();
  const active = data.filter((b) => !b.is_archived || String(b.id) === p.value);
  return (
    <Select value={p.value || NONE} onValueChange={(v) => p.onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} className="w-full">
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent>
        {allowPersonal && <SelectItem value={NONE}>Personal</SelectItem>}
        {active.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A project of the chosen business. "" = business-wide (not for one project). */
export function ProjectSelect({ businessId, ...p }: SelectProps & { businessId: string }) {
  const { data = [] } = useProjects(businessId ? Number(businessId) : null);
  return (
    <Select value={p.value || NONE} onValueChange={(v) => p.onChange(v === NONE ? "" : v)} disabled={!businessId}>
      <SelectTrigger id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} className="w-full">
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Whole business (no project)</SelectItem>
        {data.map((pr) => (
          <SelectItem key={pr.id} value={String(pr.id)}>
            {pr.name}
            {pr.status === "completed" ? " (completed)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * For money that must pass through an account (lending and repayments): pre-select the first active account when
 * nothing is chosen yet. Returns whether the user has any account, so forms can make the field required.
 */
export function useDefaultAccount(current: string, set: (id: string) => void, enabled = true) {
  const { data } = useAccounts();
  const first = data?.[0]?.id;
  useEffect(() => {
    if (enabled && !current && first) set(String(first));
  }, [enabled, current, first, set]);
  return { hasAccounts: !!data?.length, loaded: !!data };
}
