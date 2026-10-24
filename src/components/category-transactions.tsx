"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingRows } from "@/components/common";
import { TransactionsList } from "@/components/transactions-list";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatMoney, fromPaise, toPaise } from "@/lib/money";
import type { Page, Txn } from "@/lib/queries";

/** One slice of a category chart: which categories it covers (null = Uncategorized) and the chart's filters. */
export type CategoryDrill = {
  name: string;
  color: string;
  categoryIds: (number | null)[];
  kind: "expense" | "income";
  start: string;
  end: string;
};

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

/**
 * The transactions behind a slice, matching how the chart adds them up: the slice's exact categories (not their
 * sub-categories, which are slices of their own), expenses net of refunds or income only, within the period.
 */
async function loadSlice(d: CategoryDrill, signal?: AbortSignal) {
  const only = d.categoryIds.length === 1 ? d.categoryIds[0] : undefined;
  const query = {
    kind: d.kind === "expense" ? ["expense", "refund"] : ["income"],
    // The category totals are personal figures, so business entries are left out here too.
    scope: "personal",
    start: d.start,
    end: d.end,
    // Spending counts an event linked to a month in that month: list the same expenses the chart added up.
    ...(d.kind === "expense" ? { by_spend_month: true } : {}),
    sort: "-date",
    page_size: PAGE_SIZE,
    ...(only === null ? { uncategorized: true } : only !== undefined ? { category_id: only } : {}),
  };
  const wanted = new Set(d.categoryIds);
  const items: Txn[] = [];
  let truncated = false;
  for (let page = 1; ; page++) {
    const res = await api.get<Page<Txn>>("/transactions", { ...query, page }, signal);
    items.push(...res.items.filter((t) => wanted.has(t.category?.id ?? null)));
    if (page * PAGE_SIZE >= res.total) break;
    if (page === MAX_PAGES) {
      truncated = true;
      break;
    }
  }
  const total = items.reduce((sum, t) => sum + (t.kind === "refund" ? -toPaise(t.amount) : toPaise(t.amount)), BigInt(0));
  return { items, total: fromPaise(total), truncated };
}

/** Pop-up listing the transactions of one category slice (opened by double-clicking it in a chart). */
export function CategoryTransactionsDialog({ drill, onOpenChange }: { drill: CategoryDrill | null; onOpenChange: (open: boolean) => void }) {
  const q = useQuery({
    queryKey: ["category-transactions", drill],
    queryFn: ({ signal }) => loadSlice(drill!, signal),
    enabled: !!drill,
  });
  const count = q.data?.items.length ?? 0;
  return (
    <Dialog open={!!drill} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        {drill && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-6">
                <span className="chart-swatch size-3 shrink-0 rounded-full" style={{ background: drill.color }} aria-hidden />
                <span className="min-w-0 break-words">{drill.name}</span>
              </DialogTitle>
              <DialogDescription>
                {drill.kind === "expense" ? "Spending" : "Income"} · {formatDate(drill.start)} – {formatDate(drill.end)}
              </DialogDescription>
            </DialogHeader>
            {q.error && !q.data ? (
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : !q.data ? (
              <LoadingRows rows={4} />
            ) : (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card/60 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {count} transaction{count === 1 ? "" : "s"}
                  </p>
                  <p className="num text-xl font-semibold" data-testid="category-total">{formatMoney(q.data.total)}</p>
                </div>
                {drill.kind === "expense" && q.data.items.some((t) => t.kind === "refund") && (
                  <p className="text-xs text-muted-foreground">Refunds are subtracted from the total, as in the chart.</p>
                )}
                <TransactionsList items={q.data.items} compact emptyTitle="No transactions" emptyDescription="Nothing recorded in this category for the period." />
                {q.data.truncated && <p className="text-xs text-muted-foreground">Showing the latest {count} transactions.</p>}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
