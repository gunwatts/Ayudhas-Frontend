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
import { AnimatedMoney } from "@/components/motion";
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

/** Accent colours for KPI cards: an icon chip and a faint glow in the card's corner. */
const ACCENTS = {
  neutral: { chip: "bg-foreground/5 text-muted-foreground", glow: "transparent" },
  salary: { chip: "bg-salary/15 text-salary", glow: "var(--salary)" },
  spend: { chip: "bg-spend/15 text-spend", glow: "var(--spend)" },
  remain: { chip: "bg-remain/15 text-remain", glow: "var(--remain)" },
  gold: { chip: "bg-chart-4/15 text-chart-4", glow: "var(--chart-4)" },
  violet: { chip: "bg-chart-7/15 text-chart-7", glow: "var(--chart-7)" },
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  accent = "neutral",
  loading,
  className,
  delay = 0,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "auto";
  accent?: keyof typeof ACCENTS;
  loading?: boolean;
  className?: string;
  /** Entrance stagger in seconds. */
  delay?: number;
  testId?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <Card className={cn("lift animate-rise relative gap-0 py-4", className)} style={{ ["--delay" as string]: `${delay}s` }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-25 blur-2xl"
        style={{ background: a.glow }}
      />
      <CardContent className="relative px-4">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          {Icon && (
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", a.chip)}>
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-32" />
        ) : (
          <div className="mt-1.5 text-2xl font-semibold tracking-tight">
            <AnimatedMoney value={value} tone={tone} data-testid={testId} />
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

export function ProgressBar({
  value,
  tone = "primary",
  label,
  className,
}: {
  value: number;
  tone?: "primary" | "warning" | "danger" | "positive";
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    primary: "bg-gradient-to-r from-primary/70 to-primary",
    warning: "bg-gradient-to-r from-warning/70 to-warning",
    danger: "bg-gradient-to-r from-destructive/70 to-destructive",
    positive: "bg-gradient-to-r from-positive/70 to-positive",
  }[tone];
  const track = { primary: "bg-primary/12", warning: "bg-warning/15", danger: "bg-destructive/15", positive: "bg-positive/15" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full", track, className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("animate-grow-x h-full rounded-full transition-[width] duration-700", fill)} style={{ width: `${pct}%` }} />
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

/** "Down 4% vs previous" style comparison; `upIsGood` decides the colour. */
export function Delta({ current, previous, upIsGood }: { current: string; previous: string; upIsGood: boolean }) {
  const c = Number(current);
  const p = Number(previous);
  if (!p) return <span className="text-xs text-muted-foreground">No data in the previous period</span>;
  const pct = ((c - p) / Math.abs(p)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-muted-foreground">About the same as before</span>;
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", good ? "text-positive" : "text-negative")}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? "Up" : "Down"} {Math.abs(pct).toFixed(1)}% vs previous
    </span>
  );
}
