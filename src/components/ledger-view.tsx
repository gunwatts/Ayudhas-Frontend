"use client";

import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CategoryBreakdown } from "@/components/charts";
import { ErrorState, LoadingRows, Money } from "@/components/common";
import { NONE } from "@/components/fields";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { TransactionsList } from "@/components/transactions-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/api";
import { useAccounts, useCategories, useCategoryTotals, useFlows, useTransactions } from "@/lib/queries";

const KIND_FILTERS: Record<string, { label: string; kinds?: string[] }> = {
  all: { label: "All types" },
  income: { label: "Income", kinds: ["income"] },
  expense: { label: "Expenses & refunds", kinds: ["expense", "refund"] },
  transfer: { label: "Transfers", kinds: ["transfer"] },
  loans: { label: "Loans", kinds: ["loan_disbursement", "loan_repayment", "lend", "lend_repayment"] },
  custody: { label: "Held for others", kinds: ["custody_in", "custody_out"] },
  investments: { label: "Investments", kinds: ["investment_buy", "investment_sell"] },
  adjustments: { label: "Adjustments", kinds: ["adjustment_in", "adjustment_out"] },
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function downloadCsv(params: URLSearchParams) {
  const res = await fetch(`${API_BASE_URL}/api/v1/transactions/export.csv?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${params.get("start") ?? "all"}-to-${params.get("end") ?? "now"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Transactions with filters. `fixedKind` locks the view to income or expenses. */
export function LedgerView({ fixedKind }: { fixedKind?: "income" | "expense" }) {
  const [period, setPeriod] = usePeriod("this_month");
  const [kindKey, setKindKey] = useState(fixedKind ?? "all");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-date");
  const q = useDebounced(search);
  const pageSize = 50;
  // Any filter change returns to page 1 (page is tied to the filter combination it was chosen for).
  const filterKey = JSON.stringify([period.start, period.end, kindKey, accountId, categoryId, q, sort]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (update: (p: number) => number) => setPageState({ key: filterKey, page: update(page) });

  const kinds = KIND_FILTERS[kindKey]?.kinds;
  const filters = {
    kind: kinds,
    start: period.start,
    end: period.end,
    account_id: accountId ? Number(accountId) : undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    q: q || undefined,
    sort,
    page,
    page_size: pageSize,
  };
  const txns = useTransactions(filters);
  const accounts = useAccounts(true);
  const categories = useCategories(fixedKind === "income" ? "income" : fixedKind === "expense" ? "expense" : undefined);
  const flows = useFlows(period.start, period.end);
  const breakdown = useCategoryTotals(period.start, period.end, fixedKind ?? "expense");
  const totalPages = txns.data ? Math.max(1, Math.ceil(txns.data.total / pageSize)) : 1;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description, merchant, notes…" className="pl-8" aria-label="Search transactions" />
        </div>
        {!fixedKind && (
          <Select value={kindKey} onValueChange={setKindKey}>
            <SelectTrigger className="w-44" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_FILTERS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={accountId || NONE} onValueChange={(v) => setAccountId(v === NONE ? "" : v)}>
          <SelectTrigger className="w-40" aria-label="Account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All accounts</SelectItem>
            {accounts.data?.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId || NONE} onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}>
          <SelectTrigger className="w-44" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All categories</SelectItem>
            {categories.data?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-36" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-date">Newest first</SelectItem>
            <SelectItem value="date">Oldest first</SelectItem>
            <SelectItem value="-amount">Largest first</SelectItem>
            <SelectItem value="amount">Smallest first</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            const p = new URLSearchParams({ start: period.start, end: period.end });
            kinds?.forEach((k) => p.append("kind", k));
            downloadCsv(p).catch(() => toast.error("Couldn't export. Please try again."));
          }}
        >
          <Download /> CSV
        </Button>
      </div>

      {fixedKind && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">{fixedKind === "income" ? "Total income" : "Total expenses"} in period</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              <p className="text-3xl font-semibold tracking-tight">
                <Money value={fixedKind === "income" ? flows.data?.income : flows.data?.expenses} />
              </p>
              <p className="text-xs text-muted-foreground">
                {fixedKind === "income"
                  ? "Includes interest received on money you lent. Loans received and transfers are not income."
                  : "Net of refunds, plus interest and fees on loans you pay. Loan principal and transfers are not expenses."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBreakdown data={breakdown.data ?? []} emptyLabel={fixedKind === "income" ? "No income in this period" : "No spending in this period"} />
            </CardContent>
          </Card>
        </div>
      )}

      {txns.error && !txns.data ? (
        <ErrorState error={txns.error} onRetry={() => txns.refetch()} />
      ) : txns.isPending ? (
        <LoadingRows rows={8} />
      ) : (
        <div className="grid gap-3" aria-busy={txns.isFetching}>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {txns.data.total} transaction{txns.data.total === 1 ? "" : "s"}
          </p>
          <TransactionsList
            items={txns.data.items}
            emptyTitle={q || accountId || categoryId ? "No matching transactions" : "Nothing recorded in this period"}
            emptyDescription={q || accountId || categoryId ? "Try a different search or clear the filters." : undefined}
          />
          {totalPages > 1 && (
            <nav className="flex items-center justify-end gap-2" aria-label="Pagination">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
