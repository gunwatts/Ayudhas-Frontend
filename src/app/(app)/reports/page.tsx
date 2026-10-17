"use client";

import { Coins, PiggyBank, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";

import { CategoryBreakdown, CompareChart, SalaryExpensesChart } from "@/components/charts";
import { Delta, ErrorState, InfoTip, Money, PageHeader, StatCard } from "@/components/common";
import { AnimatedMoney } from "@/components/motion";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { TransactionsList } from "@/components/transactions-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMonth, today } from "@/lib/dates";
import { formatMoney, isZero } from "@/lib/money";
import { type FinancialProfile, useBusinesses, useBusinessOverview, useBusinessReport, useCategoryTotals, useCompare, useFlows, useTransactions, useTrend } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const SOURCE_SHORT: Record<string, string> = { income: "Recorded income", set: "Set for the month", none: "Not recorded" };

type Kpi = { label: string; key: "salary" | "expenses" | "remaining" | "other_income" | "income" | "net_cash_flow"; upIsGood: boolean; icon: React.ComponentType<{ className?: string }>; color: string };
const SALARY_KPIS: Kpi[] = [
  { label: "Salary", key: "salary", upIsGood: true, icon: Sparkles, color: "salary" },
  { label: "Spent", key: "expenses", upIsGood: false, icon: ShoppingBag, color: "spend" },
  { label: "Remaining", key: "remaining", upIsGood: true, icon: PiggyBank, color: "remain" },
  { label: "Other income", key: "other_income", upIsGood: true, icon: Coins, color: "chart-4" },
];
// Freelancers and business owners: no salary needed. (Personal figures only; business figures are on the Business pages.)
const INCOME_KPIS: Kpi[] = [
  { label: "Income", key: "income", upIsGood: true, icon: TrendingUp, color: "salary" },
  { label: "Spent", key: "expenses", upIsGood: false, icon: ShoppingBag, color: "spend" },
  { label: "Kept", key: "net_cash_flow", upIsGood: true, icon: PiggyBank, color: "remain" },
];

function SalaryNote({ salaried }: { salaried: boolean }) {
  return (
    <InfoTip label="How these figures are counted">
      {salaried
        ? "Salary is monthly: income recorded under the Salary category, or else the salary set for the month on the Income page. A period counts the months that start inside it, the same rule the Overview uses. Remaining = salary − spent."
        : "Personal income and spending only. Kept = income − spent. Business income and costs are reported on the Business pages."}
    </InfoTip>
  );
}

type ChartKind = "income" | "salary" | "business" | "projects";

export default function ReportsPage() {
  const { session } = useSession();
  const profile = (session?.financial_profile ?? "salaried") as FinancialProfile;
  const salaried = profile === "salaried";
  const KPIS = salaried ? SALARY_KPIS : INCOME_KPIS;
  const [comparePeriod, setComparePeriod] = useState<"month" | "quarter" | "year">("month");
  const [months, setMonths] = useState(12);
  const [period, setPeriod] = usePeriod("this_year");
  const compare = useCompare(comparePeriod);
  const trend = useTrend(months);
  const businesses = useBusinesses();
  const hasBusiness = !!businesses.data?.length;
  const hasSalary = !!trend.data?.some((t) => !isZero(t.salary));
  const [chartChoice, setChartChoice] = useState<ChartKind | null>(null);
  const preferred: ChartKind = profile === "business" && hasBusiness ? "business" : salaried && hasSalary ? "salary" : "income";
  // A choice that no longer applies (no salary data, no business) falls back to the profile's default.
  const chart: ChartKind =
    chartChoice && !(chartChoice === "salary" && !hasSalary) && !((chartChoice === "business" || chartChoice === "projects") && !hasBusiness) ? chartChoice : preferred;
  const [projectBusiness, setProjectBusiness] = useState<string>("");
  const businessForProjects = projectBusiness || (businesses.data?.[0] ? String(businesses.data[0].id) : "");
  const bizTrend = useBusinessOverview(`${today().slice(0, 4)}-01-01`, today(), chart === "business", months);
  const projectReport = useBusinessReport(chart === "projects" && businessForProjects ? Number(businessForProjects) : null, period.start, period.end);
  const flows = useFlows(period.start, period.end);
  const expenses = useCategoryTotals(period.start, period.end, "expense");
  const income = useCategoryTotals(period.start, period.end, "income");
  const largest = useTransactions({ kind: ["expense"], start: period.start, end: period.end, sort: "-amount", page_size: 10 });

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Reports"
        description={salaried ? "Salary, spending and what's left over time, calculated from your records." : "Income, spending and what you kept over time, calculated from your records."}
      />

      <Card className="animate-rise">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-1.5 text-base">This {comparePeriod} vs last <SalaryNote salaried={salaried} /></CardTitle>
            {compare.data && (
              <CardDescription>
                {formatDate(compare.data.current_range.start)} – {formatDate(compare.data.current_range.end)} compared with {formatDate(compare.data.previous_range.start)} – {formatDate(compare.data.previous_range.end)}
              </CardDescription>
            )}
          </div>
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
            <Skeleton className="h-28 w-full" />
          ) : (
            <div className={cn("grid gap-4 sm:grid-cols-2", KPIS.length === 4 ? "xl:grid-cols-[1.4fr_1fr_1fr_1fr]" : "xl:grid-cols-3")}>
              {KPIS.map((k, i) => {
                const Icon = k.icon;
                const primary = k.key === "salary" || k.key === "income";
                return (
                  <div
                    key={k.key}
                    data-testid={`report-${k.key}`}
                    className={cn(
                      "lift animate-rise relative grid gap-1.5 overflow-hidden rounded-xl border bg-card p-4",
                      primary && "border-salary/40 sm:col-span-2 xl:col-span-1",
                    )}
                    style={{ ["--delay" as string]: `${i * 0.06}s` }}
                  >
                    <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full opacity-25 blur-2xl" style={{ background: `var(--${k.color})` }} />
                    <p className="relative flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      {k.label}
                      <span className="grid size-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, var(--${k.color}) 15%, transparent)`, color: `var(--${k.color})` }}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                    </p>
                    <p className={cn("relative font-semibold tracking-tight", primary ? "text-3xl text-salary" : "text-2xl")}>
                      <AnimatedMoney value={compare.data.current[k.key]} tone={k.key === "remaining" || k.key === "net_cash_flow" ? "auto" : "neutral"} />
                    </p>
                    <p className="relative text-xs text-muted-foreground">Previous: {formatMoney(compare.data.previous[k.key])}</p>
                    <span className="relative"><Delta current={compare.data.current[k.key]} previous={compare.data.previous[k.key]} upIsGood={k.upIsGood} /></span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="animate-rise" style={{ ["--delay" as string]: "0.06s" }}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="text-base">
              {{ income: "Income vs expenses", salary: "Salary vs expenses", business: "Business income vs costs", projects: "Project-wise income and costs" }[chart]}
            </CardTitle>
            <CardDescription>
              {
                {
                  income: "Personal income received, money spent and what you kept, month by month.",
                  salary: "Salary received, money spent and what remained, month by month.",
                  business: "All your businesses: income, costs and profit, month by month.",
                  projects: "Each project's income, costs and profit in the period chosen under Breakdown.",
                }[chart]
              }
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chart} onValueChange={(v) => setChartChoice(v as ChartKind)}>
              <SelectTrigger className="w-52" aria-label="Report">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income vs expenses</SelectItem>
                <SelectItem value="salary" disabled={!hasSalary}>
                  Salary vs expenses{hasSalary ? "" : " (no salary yet)"}
                </SelectItem>
                {hasBusiness && <SelectItem value="business">Business income vs costs</SelectItem>}
                {hasBusiness && <SelectItem value="projects">Project-wise</SelectItem>}
              </SelectContent>
            </Select>
            {chart === "projects" ? (
              <Select value={businessForProjects} onValueChange={setProjectBusiness}>
                <SelectTrigger className="w-44" aria-label="Business">
                  <SelectValue placeholder="Business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.data?.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Tabs value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                <TabsList>
                  <TabsTrigger value="6">6 mo</TabsTrigger>
                  <TabsTrigger value="12">12 mo</TabsTrigger>
                  <TabsTrigger value="24">24 mo</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {chart === "salary" ? (
            trend.data ? <SalaryExpensesChart key={months} data={trend.data} height={300} /> : <Skeleton className="h-72 w-full" />
          ) : chart === "income" ? (
            trend.data ? (
              <CompareChart key={months} rows={trend.data.map((t) => ({ key: t.month, label: t.month, a: t.income, b: t.expenses }))} aLabel="Income" bLabel="Spent" netLabel="Kept" height={300} emptyLabel="No income or spending in these months" />
            ) : (
              <Skeleton className="h-72 w-full" />
            )
          ) : chart === "business" ? (
            bizTrend.data ? (
              <CompareChart key={months} rows={bizTrend.data.trend.map((t) => ({ key: t.month, label: t.month, a: t.income, b: t.expenses }))} aLabel="Income" bLabel="Costs" netLabel="Profit" height={300} emptyLabel="No business income or costs in these months" />
            ) : (
              <Skeleton className="h-72 w-full" />
            )
          ) : projectReport.data ? (
            <CompareChart
              monthly={false}
              rows={projectReport.data.projects.filter((p) => p.has_data).map((p) => ({ key: String(p.id), label: p.name, a: p.income, b: p.expenses }))}
              aLabel="Income"
              bLabel="Costs"
              netLabel="Profit"
              height={300}
              emptyLabel="No project income or costs in this period. Link expenses to a project when you record them."
            />
          ) : (
            <Skeleton className="h-72 w-full" />
          )}
          {trend.data && (chart === "salary" || chart === "income") && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Salary</TableHead>
                      <TableHead className="text-right">Spent</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Other income</TableHead>
                      <TableHead>Salary from</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trend.data.map((r) => (
                      <TableRow key={r.month}>
                        <TableCell>{formatMonth(r.month)}</TableCell>
                        <TableCell className="num text-right">{formatMoney(r.salary)}</TableCell>
                        <TableCell className="num text-right">{formatMoney(r.expenses)}</TableCell>
                        <TableCell className="text-right"><Money value={r.remaining} tone="auto" /></TableCell>
                        <TableCell className="num text-right">{formatMoney(r.other_income)}</TableCell>
                        <TableCell className="text-muted-foreground">{SOURCE_SHORT[r.salary_source]}</TableCell>
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
      <section className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4" aria-label="Totals for the selected period">
        {salaried ? (
          <>
            <StatCard label="Salary" value={flows.data?.salary} icon={Sparkles} accent="salary" loading={!flows.data} hint="Months that start in this period" />
            <StatCard label="Spent" value={flows.data?.expenses} icon={ShoppingBag} accent="spend" loading={!flows.data} hint="Including event spending" delay={0.05} />
            <StatCard label="Remaining" value={flows.data?.remaining} tone="auto" icon={PiggyBank} accent="remain" loading={!flows.data} hint="Salary − spent" delay={0.1} />
            <StatCard label="Other income" value={flows.data?.other_income} icon={Coins} accent="gold" loading={!flows.data} hint="Income that is not salary" delay={0.15} />
          </>
        ) : (
          <>
            <StatCard label="Income" value={flows.data?.income} icon={TrendingUp} accent="salary" loading={!flows.data} hint="Personal income" />
            <StatCard label="Spent" value={flows.data?.expenses} icon={ShoppingBag} accent="spend" loading={!flows.data} hint="Including event spending" delay={0.05} />
            <StatCard label="Kept" value={flows.data?.net_cash_flow} tone="auto" icon={PiggyBank} accent="remain" loading={!flows.data} hint="Income − spent" delay={0.1} />
            <StatCard label="Salary" value={flows.data?.salary} icon={Sparkles} accent="gold" loading={!flows.data} hint="If you record any" delay={0.15} />
          </>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Spending by category</CardTitle></CardHeader>
          <CardContent>{expenses.data ? <CategoryBreakdown data={expenses.data} period={period} /> : <Skeleton className="h-60 w-full" />}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Income by source</CardTitle></CardHeader>
          <CardContent>{income.data ? <CategoryBreakdown data={income.data} emptyLabel="No income recorded in this period" defaultView="bars" period={period} kind="income" /> : <Skeleton className="h-60 w-full" />}</CardContent>
        </Card>
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold">Largest expenses</h3>
        {largest.data ? <TransactionsList items={largest.data.items} compact emptyTitle="No expenses in this period" /> : <Skeleton className="h-64 w-full" />}
      </div>
    </div>
  );
}
