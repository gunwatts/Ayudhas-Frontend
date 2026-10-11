"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoney, isNegative } from "@/lib/money";

export function Money({
  value,
  className,
  compact,
  sign,
  tone = "neutral",
}: {
  value: string | number | null | undefined;
  className?: string;
  compact?: boolean;
  sign?: boolean;
  /** "auto" colours negatives red; "in"/"out" force income/expense styling. */
  tone?: "neutral" | "auto" | "in" | "out";
}) {
  const negative = typeof value === "string" ? isNegative(value) : typeof value === "number" && value < 0;
  const color =
    tone === "in" ? "text-positive" : tone === "out" ? "text-foreground" : tone === "auto" && negative ? "text-negative" : "";
  return (
    <span className={cn("num whitespace-nowrap", color, className)} title={compact ? formatMoney(value) : undefined}>
      {formatMoney(value, { compact, sign })}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  loading,
  className,
}: {
  label: string;
  value: string | null | undefined;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "auto";
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-32" />
        ) : (
          <div className="mt-1.5 text-2xl font-semibold tracking-tight">
            <Money value={value} tone={tone} />
          </div>
        )}
        {hint && !loading && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      <div className="mb-3 rounded-full bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center", className)}>
      <AlertTriangle className="mb-2 size-5 text-destructive" aria-hidden />
      <p className="font-medium">Couldn&apos;t load this</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  destructive = true,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
  destructive?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInnerOpen(o));
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                /* error toast is shown by the mutation */
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProgressBar({ value, tone = "primary", label }: { value: number; tone?: "primary" | "warning" | "danger" | "positive"; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = { primary: "bg-primary", warning: "bg-warning", danger: "bg-destructive", positive: "bg-positive" }[tone];
  const track = { primary: "bg-primary/15", warning: "bg-warning/15", danger: "bg-destructive/15", positive: "bg-positive/15" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full", track)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function utilizationTone(pct: number | null | undefined): "primary" | "warning" | "danger" {
  if (pct === null || pct === undefined) return "primary";
  if (pct >= 100) return "danger";
  if (pct >= 85) return "warning";
  return "primary";
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}
