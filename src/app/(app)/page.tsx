"use client";

import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, Coins, HandCoins, Landmark, PiggyBank, Scale, TrendingUp, Vault, Wallet } from "lucide-react";
import Link from "next/link";

import { CategoryBreakdown, CompareChart, SalaryExpensesChart } from "@/components/charts";
import { EmptyState, ErrorState, InfoTip, Money, PageHeader, SectionTitle, StatCard } from "@/components/common";
import { AnimatedMoney } from "@/components/motion";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { BusinessHero, EarningsHero } from "@/components/profile-hero";
import { QuickBar } from "@/components/quick-transactions";
import { SalaryHero } from "@/components/salary-hero";
import { TransactionsList } from "@/components/transactions-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, RANGE_LABELS } from "@/lib/dates";
import { formatMoney, isZero } from "@/lib/money";
import { type FinancialProfile, useDashboard } from "@/lib/queries";
import { useSession } from "@/lib/session";

const DESCRIPTION: Record<FinancialProfile, string> = {
  salaried: "Your salary, what you spent and what's left, plus everything you own and owe.",
  freelancer: "What you earned and spent, plus everything you own and owe.",
  business: "Your business's income, costs and profit, and your personal money kept separately.",
};

function Explain({ children }: { children: React.ReactNode }) {
  return <InfoTip label="How this is calculated">{children}</InfoTip>;
}

export default function OverviewPage() {
  const [period, setPeriod] = usePeriod("this_month");
  const { data, isPending, error, refetch, isFetching } = useDashboard(period.start, period.end);
  const { session } = useSession();
  const profile: FinancialProfile = (data?.profile ?? session?.financial_profile ?? "salaried") as FinancialProfile;

  if (error && !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const pos = data?.positions;
  const flows = data?.flows;
  const noAccounts = pos && pos.accounts.length === 0;
  const periodLabel = period.preset === "custom" ? `${formatDate(period.start)} – ${formatDate(period.end)}` : RANGE_LABELS[period.preset];

  return (
    <div className="grid grid-cols-1 gap-6" aria-busy={isFetching}>
      <PageHeader title="Overview" description={DESCRIPTION[profile]} actions={<PeriodPicker value={period} onChange={setPeriod} />} />

      <QuickBar />

      {profile === "business" ? (
        <BusinessHero data={data} periodLabel={periodLabel} loading={isPending} />
      ) : profile === "freelancer" ? (
        <EarningsHero data={data} periodLabel={periodLabel} loading={isPending} />
      ) : (
        <SalaryHero data={data} periodLabel={periodLabel} start={period.start} end={period.end} loading={isPending} />
      )}

      {noAccounts && (
        <Card className="border-primary/30">
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

      {/* Position + secondary figures */}
      <section className="grid gap-4 lg:grid-cols-[1.25fr_2fr]" aria-label="Financial position">
        <Card className="lift animate-rise relative justify-between overflow-hidden" style={{ ["--delay" as string]: "0.05s" }}>
          <div aria-hidden className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-remain/20 blur-3xl" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
              <Wallet className="size-4" aria-hidden /> Your available money
              <Explain>
                Balances of your personal accounts minus money you are holding for other people. Business accounts, investments, loans and money owed to you are
                shown separately.
              </Explain>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative grid gap-4">
            {isPending ? (
              <Skeleton className="h-12 w-56" />
            ) : (
              <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                <AnimatedMoney value={pos?.personal_available} tone="auto" data-testid="available" />
              </p>
            )}
            {pos && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Cash in accounts</dt>
                <dd className="num text-right">{formatMoney(pos.cash_in_accounts)}</dd>
                {(profile === "business" || !isZero(pos.business_cash)) && (
                  <>
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><Briefcase className="size-3.5" aria-hidden /> Business accounts</dt>
                    <dd className="num text-right">{formatMoney(pos.business_cash)}</dd>
                  </>
                )}
                <dt className="flex items-center gap-1.5 text-muted-foreground"><Vault className="size-3.5" aria-hidden /> Held for others</dt>
                <dd className="num text-right">−{formatMoney(pos.held_for_others)}</dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground"><PiggyBank className="size-3.5" aria-hidden /> Savings accounts</dt>
                <dd className="num text-right">{formatMoney(pos.savings_balance)}</dd>
                {!isZero(pos.goal_allocated) && (
                  <>
                    <dt className="text-muted-foreground">Earmarked for goals</dt>
                    <dd className="num text-right">{formatMoney(pos.goal_allocated)}</dd>
                  </>
                )}
                <dt className="border-t pt-1.5 font-medium">Net worth</dt>
                <dd className="border-t pt-1.5 text-right font-medium">
                  <Money value={pos.net_worth} tone="auto" />
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          {profile === "salaried" ? (
            <StatCard label="Other income" value={flows?.other_income} icon={Coins} accent="gold" loading={isPending} hint="Interest, gifts and other income in period" delay={0.08} />
          ) : profile === "business" ? (
            <StatCard label="Personal spending" value={flows?.expenses} icon={Scale} accent="gold" loading={isPending} hint="Kept apart from business costs" delay={0.08} />
          ) : (
            <StatCard label="Other income" value={flows?.other_income} icon={Coins} accent="gold" loading={isPending} hint="Income outside the Salary category" delay={0.08} />
          )}
          <StatCard label="Loans outstanding" value={pos?.loans_outstanding} icon={Landmark} accent="spend" loading={isPending} hint={<Link className="hover:underline" href="/loans/">Money you owe</Link>} delay={0.12} />
          <StatCard label="Owed to you" value={pos?.receivables} icon={HandCoins} accent="remain" loading={isPending} hint={<Link className="hover:underline" href="/lent/">Money you lent</Link>} delay={0.16} />
          <StatCard
            label="Investments"
            value={pos?.investment_value}
            icon={TrendingUp}
            accent="violet"
            loading={isPending}
            delay={0.2}
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

      {/* 12-month comparison that matches the profile */}
      <Card className="animate-rise" style={{ ["--delay" as string]: "0.1s" }}>
        <CardHeader>
          <CardTitle className="text-base">
            {profile === "business" ? "Business income vs costs, last 12 months" : profile === "freelancer" ? "Earnings vs spending, last 12 months" : "Salary vs expenses, last 12 months"}
          </CardTitle>
          <CardDescription>
            {profile === "business"
              ? "Income, all business costs and profit each month, across your businesses."
              : profile === "freelancer"
                ? "How much you earned, how much you spent, and what you kept each month."
                : "How much salary you received, how much you spent, and how much remained each month."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-72 w-full" />
          ) : profile === "business" ? (
            <CompareChart
              rows={(data?.business?.trend ?? []).map((t) => ({ key: t.month, label: t.month, a: t.income, b: t.expenses }))}
              aLabel="Income"
              bLabel="Costs"
              netLabel="Profit"
              emptyLabel="No business income or costs recorded yet"
            />
          ) : profile === "freelancer" ? (
            <CompareChart
              rows={(data?.trend ?? []).map((t) => ({ key: t.month, label: t.month, a: t.income, b: t.expenses }))}
              aLabel="Earned"
              bLabel="Spent"
              netLabel="Kept"
              emptyLabel="No income or spending recorded yet"
            />
          ) : (
            <SalaryExpensesChart data={data?.trend ?? []} />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-rise lg:col-span-3" style={{ ["--delay" as string]: "0.12s" }}>
          <CardHeader>
            <CardTitle className="text-base">{profile === "business" ? "Personal spending by category" : "Spending by category"}</CardTitle>
            <CardDescription>{periodLabel}, including event spending{profile === "business" ? "; business costs are on the Business pages" : ""}.</CardDescription>
          </CardHeader>
          <CardContent>{isPending ? <Skeleton className="h-60 w-full" /> : <CategoryBreakdown data={data?.expense_by_category ?? []} period={period} />}</CardContent>
        </Card>
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
                        <p className="truncate text-xs text-muted-foreground">
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
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    {a.business_id && <Briefcase className="size-3.5 shrink-0 text-muted-foreground" aria-label="Business account" />}
                    {a.name}
                  </span>
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

      <section>
        <SectionTitle action={<Button variant="ghost" size="sm" asChild><Link href="/transactions/">View all <ArrowRight /></Link></Button>}>Recent transactions</SectionTitle>
        {isPending ? <Skeleton className="h-64 w-full" /> : <TransactionsList items={data?.recent ?? []} compact />}
      </section>
    </div>
  );
}
