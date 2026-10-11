"use client";

import { ArrowLeftRight, ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmAction, EmptyState } from "@/components/common";
import { TransactionForm } from "@/components/transaction-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { type Txn, useFinanceMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";

const INFLOW = new Set(["income", "refund", "loan_disbursement", "lend_repayment", "custody_in", "investment_sell", "adjustment_in"]);

export function direction(t: Txn): "in" | "out" | "move" {
  if (t.kind === "transfer") return "move";
  return INFLOW.has(t.kind) ? "in" : "out";
}

export function workflowHref(t: Txn) {
  if (t.loan_id) return `/loans/view/?id=${t.loan_id}`;
  if (t.custody_id) return `/custody/view/?id=${t.custody_id}`;
  if (t.investment_id) return `/investments/view/?id=${t.investment_id}`;
  return null;
}

function title(t: Txn) {
  return t.description || t.merchant || t.category?.name || t.counterparty?.name || t.kind_label;
}

function subtitle(t: Txn) {
  const parts: string[] = [];
  if (t.kind === "transfer") parts.push(`${t.account?.name ?? "?"} → ${t.to_account?.name ?? "?"}`);
  else {
    if (t.category && t.description) parts.push(t.category.name);
    if (t.account) parts.push(t.account.name);
    else parts.push("No account");
  }
  if (t.event) parts.push(t.event.name);
  return parts.join(" · ");
}

export function AmountCell({ t }: { t: Txn }) {
  const dir = direction(t);
  return (
    <span className={cn("num font-medium whitespace-nowrap", dir === "in" && "text-positive")}>
      {dir === "in" ? "+" : dir === "out" ? "−" : ""}
      {formatMoney(t.amount)}
    </span>
  );
}

function RowActions({ t, onEdit }: { t: Txn; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/transactions/${t.id}`), { success: "Transaction deleted" });
  const href = workflowHref(t);
  if (t.is_workflow && href)
    return (
      <Button variant="ghost" size="icon-sm" asChild aria-label="Open related record">
        <Link href={href}>
          <ExternalLink />
        </Link>
      </Button>
    );
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title(t)}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-destructive focus:text-destructive">
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmAction
      open={confirming}
      onOpenChange={setConfirming}
      title="Delete this transaction?"
      description={`${t.kind_label} of ${formatMoney(t.amount)} on ${formatDate(t.date)}. Balances and reports update immediately. The deletion is kept in the audit log.`}
      onConfirm={() => del.mutateAsync(undefined)}
    />
    </>
  );
}

export function TransactionsList({ items, emptyTitle = "No transactions yet", emptyDescription, compact }: { items: Txn[]; emptyTitle?: string; emptyDescription?: string; compact?: boolean }) {
  const [editing, setEditing] = useState<Txn | null>(null);
  if (!items.length) return <EmptyState title={emptyTitle} description={emptyDescription ?? "Press N or use “Add transaction” to record one."} icon={ArrowLeftRight} />;

  // Group by date for scannability. Rows fade in one after another (only the first dozen are staggered).
  const order = new Map(items.map((t, i) => [t.id, i]));
  const groups: { date: string; rows: Txn[] }[] = [];
  for (const t of items) {
    const g = groups.at(-1);
    if (g && g.date === t.date) g.rows.push(t);
    else groups.push({ date: t.date, rows: [t] });
  }

  return (
    <>
      <div className="divide-y rounded-xl border bg-card">
        {groups.map((g) => (
          <section key={g.date} aria-label={formatDate(g.date, "EEEE, d MMMM yyyy")}>
            {!compact && <h3 className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">{formatDate(g.date, "EEE, d MMM yyyy")}</h3>}
            <ul className="divide-y">
              {g.rows.map((t) => (
                <li key={t.id} className="animate-rise flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40" style={{ ["--delay" as string]: `${Math.min(order.get(t.id) ?? 0, 12) * 0.03}s` }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{title(t)}</p>
                      {t.kind !== "expense" && t.kind !== "income" && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                          {t.kind_label}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {compact && `${formatDate(t.date, "d MMM")} · `}
                      {subtitle(t)}
                      {t.time && ` · ${t.time.slice(0, 5)}`}
                    </p>
                  </div>
                  <AmountCell t={t} />
                  {!compact && <RowActions t={t} onEdit={() => setEditing(t)} />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          {editing && <TransactionForm initial={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
