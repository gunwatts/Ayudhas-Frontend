"use client";

import { ArrowRight, Laptop, Store } from "lucide-react";
import Link from "next/link";

import { InfoTip } from "@/components/common";
import { AnimatedMoney, RingProgress } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isNegative, isZero, toNumber } from "@/lib/money";
import type { Dashboard } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Figure = { label: string; value: string | undefined; tone: string; color?: string; testId?: string };

function HeroShell({
  icon: Icon,
  title,
  periodLabel,
  info,
  figures,
  loading,
  ring,
  footer,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  periodLabel: string;
  info: React.ReactNode;
  figures: Figure[];
  loading: boolean;
  ring: { pct: number | null; caption: string; empty: string };
  footer?: React.ReactNode;
  testId: string;
}) {
  const pct = ring.pct;
  return (
    <Card className="animate-rise relative gap-0 overflow-hidden py-0" data-testid={testId}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_20rem_at_0%_0%,color-mix(in_srgb,var(--salary)_16%,transparent),transparent_60%),radial-gradient(40rem_18rem_at_100%_100%,color-mix(in_srgb,var(--remain)_14%,transparent),transparent_60%)]" />
      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid min-w-0 gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-salary/15 text-salary">
              <Icon className="size-4" aria-hidden />
            </span>
            <h2 className="text-base font-semibold">{title}</h2>
            <span className="rounded-full border bg-card/70 px-2 py-0.5 text-xs text-muted-foreground">{periodLabel}</span>
            <InfoTip label={`How ${title.toLowerCase()} is worked out`}>{info}</InfoTip>
          </div>
          {loading ? (
            <div className={cn("grid gap-3", figures.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
              {figures.map((f) => <Skeleton key={f.label} className="h-16" />)}
            </div>
          ) : (
            <dl className={cn("grid gap-4", figures.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
              {figures.map((f) => (
                <div key={f.label} className={cn("grid min-w-0 gap-1 border-l-2 pl-3", f.tone)}>
                  <dt className="text-sm text-muted-foreground">{f.label}</dt>
                  <dd className={cn("truncate text-2xl font-semibold tracking-tight sm:text-3xl", f.color)}>
                    <AnimatedMoney value={f.value} data-testid={f.testId} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {footer}
        </div>
        <div className="flex items-center justify-center gap-4 md:flex-col">
          <RingProgress
            value={pct}
            color={pct !== null && pct >= 100 ? "var(--destructive)" : pct !== null && pct >= 85 ? "var(--warning)" : "var(--spend)"}
            label={pct === null ? ring.empty : `${pct.toFixed(0)}% ${ring.caption}`}
          >
            <div>
              <p className="num text-2xl font-semibold">{pct === null ? "—" : `${Math.round(pct)}%`}</p>
              <p className="max-w-24 text-[11px] text-muted-foreground">{pct === null ? ring.empty : ring.caption}</p>
            </div>
          </RingProgress>
        </div>
      </div>
    </Card>
  );
}

/** Freelancers: what you earned vs what you spent, with no salary involved. */
export function EarningsHero({ data, periodLabel, loading }: { data?: Dashboard; periodLabel: string; loading: boolean }) {
  const flows = data?.flows;
  const earned = toNumber(flows?.income);
  const spent = toNumber(flows?.expenses);
  const negative = flows ? isNegative(flows.net_cash_flow) : false;
  return (
    <HeroShell
      testId="earnings-hero"
      icon={Laptop}
      title="Earnings vs spending"
      periodLabel={periodLabel}
      loading={loading || !flows}
      info="Earned is all personal income in the period (client payments, interest and any other income). Spent is every personal expense, net of refunds. Business income and costs are kept on the Business pages."
      figures={[
        { label: "Earned", value: flows?.income, tone: "border-salary", color: "text-salary", testId: "kpi-earned" },
        { label: "Spent", value: flows?.expenses, tone: "border-spend", testId: "kpi-spent" },
        { label: negative ? "Spent more than earned" : "Kept", value: flows?.net_cash_flow, tone: "border-remain", color: negative ? "text-negative" : "text-remain", testId: "kpi-kept" },
      ]}
      ring={{ pct: earned > 0 ? (spent / earned) * 100 : null, caption: "of earnings spent", empty: "no earnings yet" }}
      footer={
        flows && isZero(flows.income) ? (
          <div>
            <Button asChild size="sm" variant="outline" className="h-7 rounded-full">
              <Link href="/income/">Record income <ArrowRight /></Link>
            </Button>
          </div>
        ) : null
      }
    />
  );
}

/** Business owners: business income, operating and project costs, and profit. */
export function BusinessHero({ data, periodLabel, loading }: { data?: Dashboard; periodLabel: string; loading: boolean }) {
  const b = data?.business;
  const income = toNumber(b?.income);
  const costs = toNumber(b?.expenses);
  const loss = b ? isNegative(b.profit) : false;
  return (
    <HeroShell
      testId="business-hero"
      icon={Store}
      title="Business"
      periodLabel={periodLabel}
      loading={loading || !data}
      info="All your businesses together. Profit is business income minus business expenses (refunds reduce costs). Operating costs are business-wide (rent, electricity, salaries); project costs are linked to a project. Transfers, loans and balance adjustments are never income or costs. Personal money is shown separately below."
      figures={[
        { label: "Income", value: b?.income ?? "0", tone: "border-salary", color: "text-salary", testId: "kpi-biz-income" },
        { label: "Operating costs", value: b?.operating_expenses ?? "0", tone: "border-spend" },
        { label: "Project costs", value: b?.project_expenses ?? "0", tone: "border-chart-4" },
        { label: loss ? "Loss" : "Profit", value: b?.profit ?? "0", tone: "border-remain", color: loss ? "text-negative" : "text-remain", testId: "kpi-biz-profit" },
      ]}
      ring={{ pct: income > 0 ? (costs / income) * 100 : null, caption: "of income spent on costs", empty: "no income yet" }}
      footer={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {b && b.business_count === 0 ? (
            <Button asChild size="sm" className="h-7 rounded-full">
              <Link href="/business/">Add your business <ArrowRight /></Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="h-7 rounded-full">
              <Link href="/business/">Businesses & projects <ArrowRight /></Link>
            </Button>
          )}
        </div>
      }
    />
  );
}
