"use client";

import { AlertTriangle, ArrowRight, CalendarClock, HandCoins, Info, Landmark, PiggyBank, TrendingUp, Vault, Wallet } from "lucide-react";
import Link from "next/link";

import { CashflowChart, CategoryBreakdown } from "@/components/charts";
import { EmptyState, ErrorState, Money, PageHeader, ProgressBar, SectionTitle, StatCard, utilizationTone } from "@/components/common";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { TransactionsList } from "@/components/transactions-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/dates";
import { formatMoney, isNegative, isZero } from "@/lib/money";
import { useDashboard } from "@/lib/queries";

function Explain({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="How this is calculated">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export default function OverviewPage() {
  const [period, setPeriod] = usePeriod("this_month");
  const { data, isPending, error, refetch, isFetching } = useDashboard(period.start, period.end);

  if (error && !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const pos = data?.positions;
  const flows = data?.flows;
  const noAccounts = pos && pos.accounts.length === 0;

  return (
    <div className="grid gap-6" aria-busy={isFetching}>
      <PageHeader title="Overview" description="Where your money is, what you owe, and what's owed to you." actions={<PeriodPicker value={period} onChange={setPeriod} />} />

      {noAccounts && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Add your bank accounts, cash and wallets</p>
              <p className="text-sm text-muted-foreground">Balances are calculated from accounts. Spending you record without an account still appears in reports.</p>
            </div>
            <Button asChild>
              <Link href="/accounts/">
                Add an account <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Headline position */}
      <section className="grid gap-4 lg:grid-cols-[1.3fr_2fr]" aria-label="Financial position">
        <Card className="justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
              Your available money
              <Explain>Balances of your own accounts minus money you are holding for other people. Investments, loans and receivables are shown separately.</Explain>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isPending ? (
              <Skeleton className="h-12 w-56" />
            ) : (
              <p className="text-5xl font-semibold tracking-tight" data-testid="available">
                <Money value={pos?.personal_available} tone="auto" />
              </p>
            )}
            {pos && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Cash in accounts</dt>
                <dd className="num text-right">{formatMoney(pos.cash_in_accounts)}</dd>
                <dt className="text-muted-foreground">Held for others</dt>
                <dd className="num text-right">−{formatMoney(pos.held_for_others)}</dd>
                <dt className="font-medium">Net worth</dt>
                <dd className="text-right font-medium">
                  <Money value={pos.net_worth} tone="auto" />
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Income" value={flows?.income} loading={isPending} hint="Earned in period (excludes loans & transfers)" />
          <StatCard label="Expenses" value={flows?.expenses} loading={isPending} hint="Spending + loan interest/fees" />
          <StatCard
            label="Net cash flow"
            value={flows?.net_cash_flow}
            tone="auto"
            loading={isPending}
            hint={flows && !isNegative(flows.net_cash_flow) ? "Saved this period" : flows ? "Spent more than earned" : undefined}
          />
          <StatCard label="Loans outstanding" value={pos?.loans_outstanding} icon={Landmark} loading={isPending} hint={<Link className="hover:underline" href="/loans/">Money you owe</Link>} />
          <StatCard label="Owed to you" value={pos?.receivables} icon={HandCoins} loading={isPending} hint={<Link className="hover:underline" href="/lent/">Money you lent</Link>} />
          <StatCard
            label="Investments"
            value={pos?.investment_value}
            icon={TrendingUp}
            loading={isPending}
            hint={
              pos && pos.investments_unvalued > 0
                ? `${pos.investments_unvalued} holding(s) shown at cost — no valuation entered`
                : pos
                  ? `Invested ${formatMoney(pos.invested_principal)}`
                  : undefined
            }
          />
        </div>
      </section>

      {/* Budget + secondary positions */}
      <section className="grid gap-4 md:grid-cols-3" aria-label="Budget and holdings">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">This month&apos;s budget</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : data?.budget ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Spent <Money value={data.budget.spent} className="font-medium text-foreground" /> of <Money value={data.budget.available} />
                  </p>
                  <p className="text-sm">
                    <Money value={data.budget.remaining} tone="auto" className="font-semibold" /> <span className="text-muted-foreground">{isNegative(data.budget.remaining) ? "over budget" : "left"}</span>
                  </p>
                </div>
                <ProgressBar value={data.budget.utilization ?? 0} tone={utilizationTone(data.budget.utilization)} label="Budget used" />
                {(data.budget.utilization ?? 0) >= 85 && (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="size-3.5" /> {(data.budget.utilization ?? 0) >= 100 ? "You're over this month's budget." : "You've used most of this month's budget."}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
                No budget set for this month.
                <Button variant="outline" size="sm" asChild>
                  <Link href="/budgets/">Set a budget</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground"><Vault className="size-4" /> Held for others</span>
              <Money value={pos?.held_for_others} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground"><PiggyBank className="size-4" /> Savings accounts</span>
              <Money value={pos?.savings_balance} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground"><PiggyBank className="size-4" /> Earmarked for goals</span>
              <Money value={pos?.goal_allocated} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground"><Wallet className="size-4" /> Accounts</span>
              <span>{pos?.accounts.filter((a) => !a.is_archived).length ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-5" aria-label="Charts">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Income vs expenses, last 12 months</CardTitle>
          </CardHeader>
          <CardContent>{isPending ? <Skeleton className="h-64 w-full" /> : <CashflowChart data={data?.trend ?? []} />}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Spending by category</CardTitle>
          </CardHeader>
          <CardContent>{isPending ? <Skeleton className="h-44 w-full" /> : <CategoryBreakdown data={data?.expense_by_category ?? []} />}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionTitle action={<Button variant="ghost" size="sm" asChild><Link href="/transactions/">View all <ArrowRight /></Link></Button>}>Recent transactions</SectionTitle>
          {isPending ? <Skeleton className="h-64 w-full" /> : <TransactionsList items={data?.recent ?? []} compact />}
        </div>
        <div className="grid content-start gap-4 lg:col-span-2">
          <div>
            <SectionTitle>Upcoming & overdue</SectionTitle>
            {data && data.upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing due soon" description="Loan installments due in the next 45 days appear here." />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {data?.upcoming.map((u) => (
                  <li key={u.loan_id}>
                    <Link href={`/loans/view/?id=${u.loan_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.direction === "taken" ? "You pay" : "Expected from"} {u.counterparty} · {formatDate(u.due_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money value={u.amount} className="text-sm font-medium" />
                        {u.overdue && <p className="flex items-center justify-end gap-1 text-xs text-negative"><AlertTriangle className="size-3" />Overdue</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionTitle action={<Button variant="ghost" size="sm" asChild><Link href="/accounts/">Manage <ArrowRight /></Link></Button>}>Account balances</SectionTitle>
            <ul className="divide-y rounded-xl border bg-card">
              {pos?.accounts.filter((a) => !a.is_archived).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="truncate">{a.name}</span>
                  <Money value={a.balance} tone="auto" className="font-medium" />
                </li>
              ))}
              {pos && pos.accounts.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No accounts yet</li>}
              {pos && !isZero(pos.held_for_others) && (
                <li className="flex items-center justify-between bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                  <span>of which belongs to others</span>
                  <span className="num">{formatMoney(pos.held_for_others)}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
