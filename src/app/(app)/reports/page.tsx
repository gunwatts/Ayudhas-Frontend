"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState } from "react";

import { CashflowChart, CategoryBreakdown } from "@/components/charts";
import { ErrorState, Money, PageHeader } from "@/components/common";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { TransactionsList } from "@/components/transactions-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/money";
import { useCategoryTotals, useCompare, useTransactions, useTrend } from "@/lib/queries";

function Delta({ current, previous, upIsGood }: { current: string; previous: string; upIsGood: boolean }) {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (p === 0) return <span className="text-xs text-muted-foreground">No data in the previous period</span>;
  const pct = ((c - p) / Math.abs(p)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3" /> About the same</span>;
  const up = pct > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`flex items-center gap-1 text-xs ${good ? "text-positive" : "text-negative"}`}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "Up" : "Down"} {Math.abs(pct).toFixed(1)}% vs previous
    </span>
  );
}

export default function ReportsPage() {
  const [comparePeriod, setComparePeriod] = useState<"month" | "quarter" | "year">("month");
  const [months, setMonths] = useState(12);
  const [period, setPeriod] = usePeriod("this_year");
  const compare = useCompare(comparePeriod);
  const trend = useTrend(months);
  const expenses = useCategoryTotals(period.start, period.end, "expense");
  const income = useCategoryTotals(period.start, period.end, "income");
  const largest = useTransactions({ kind: ["expense"], start: period.start, end: period.end, sort: "-amount", page_size: 10 });

  return (
    <div className="grid gap-6">
      <PageHeader title="Reports" description="Trends and comparisons, calculated from your recorded transactions." />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">This {comparePeriod} vs last</CardTitle>
          <Tabs value={comparePeriod} onValueChange={(v) => setComparePeriod(v as typeof comparePeriod)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {compare.error ? (
            <ErrorState error={compare.error} onRetry={() => compare.refetch()} />
          ) : !compare.data ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Income", "income", true],
                  ["Expenses", "expenses", false],
                  ["Net cash flow", "net_cash_flow", true],
                ] as const
              ).map(([label, key, upGood]) => (
                <div key={key} className="grid gap-1 rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold tracking-tight"><Money value={compare.data.current[key]} tone={key === "net_cash_flow" ? "auto" : "neutral"} /></p>
                  <p className="text-xs text-muted-foreground">Previous: {formatMoney(compare.data.previous[key])}</p>
                  <Delta current={compare.data.current[key]} previous={compare.data.previous[key]} upIsGood={upGood} />
                </div>
              ))}
            </div>
          )}
          {compare.data && (
            <p className="mt-3 text-xs text-muted-foreground">
              {formatDate(compare.data.current_range.start)} – {formatDate(compare.data.current_range.end)} compared with {formatDate(compare.data.previous_range.start)} – {formatDate(compare.data.previous_range.end)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Monthly income and expenses</CardTitle>
          <Tabs value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <TabsList>
              <TabsTrigger value="6">6 months</TabsTrigger>
              <TabsTrigger value="12">12 months</TabsTrigger>
              <TabsTrigger value="24">24 months</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="grid gap-4">
          {trend.data ? <CashflowChart data={trend.data} height={280} /> : <Skeleton className="h-72 w-full" />}
          {trend.data && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Month</TableHead><TableHead className="text-right">Income</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Net</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {trend.data.map((r) => (
                      <TableRow key={r.month}>
                        <TableCell>{formatMonth(r.month)}</TableCell>
                        <TableCell className="num text-right">{formatMoney(r.income)}</TableCell>
                        <TableCell className="num text-right">{formatMoney(r.expenses)}</TableCell>
                        <TableCell className="text-right"><Money value={r.net} tone="auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Breakdown</h2>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Spending by category</CardTitle></CardHeader>
          <CardContent>{expenses.data ? <CategoryBreakdown data={expenses.data} /> : <Skeleton className="h-44 w-full" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Income by source</CardTitle></CardHeader>
          <CardContent>{income.data ? <CategoryBreakdown data={income.data} emptyLabel="No income in this period" /> : <Skeleton className="h-44 w-full" />}</CardContent>
        </Card>
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold">Largest expenses</h3>
        {largest.data ? <TransactionsList items={largest.data.items} compact emptyTitle="No expenses in this period" /> : <Skeleton className="h-64 w-full" />}
      </div>
    </div>
  );
}
