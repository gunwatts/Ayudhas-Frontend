"use client";

import { ArrowRight, Info, Sparkles } from "lucide-react";
import Link from "next/link";

import { AnimatedMoney, RingProgress } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMonth, today } from "@/lib/dates";
import { formatMoney, isNegative, isZero, toNumber } from "@/lib/money";
import type { Dashboard } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, string> = {
  income: "from salary income you recorded",
  set: "set for the month on the Budgets page",
  none: "not recorded yet",
};

/** The single calendar month a period covers, if it covers exactly one (e.g. "This month"). */
function singleMonth(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const lastDay = new Date(ey, em, 0).getDate();
  return sd === 1 && sy === ey && sm === em && Number(end.slice(8)) === lastDay ? start.slice(0, 7) : null;
}

// Placed left of the spending ring (which sits at the right edge on wide screens).
const COINS = [
  { right: "24%", top: "10%", size: 42, dur: 6, delay: 0 },
  { right: "30%", top: "64%", size: 28, dur: 7.5, delay: -2 },
  { right: "20%", top: "80%", size: 22, dur: 5.5, delay: -4 },
];

/** Overview headline: salary received, what was spent, and what remains, for the selected period. */
export function SalaryHero({ data, periodLabel, start, end, loading }: { data?: Dashboard; periodLabel: string; start: string; end: string; loading: boolean }) {
  const flows = data?.flows;
  const salary = toNumber(flows?.salary);
  const spent = toNumber(flows?.expenses);
  const pct = salary > 0 ? (spent / salary) * 100 : null;
  const month = singleMonth(start, end);
  const point = month ? data?.trend.find((t) => t.month === month) : undefined;
  // The dashboard's budget snapshot is always the current month's, so it only applies when viewing this month.
  const thisMonth = today().slice(0, 7);
  const carried = month === thisMonth && data?.budget && !isZero(data.budget.carried_forward) ? data.budget.carried_forward : null;
  const over = flows ? isNegative(flows.remaining) : false;
  const noSalary = flows && isZero(flows.salary);

  return (
    <Card className="animate-rise relative gap-0 overflow-hidden py-0" data-testid="salary-hero" aria-labelledby="salary-hero-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_20rem_at_0%_0%,color-mix(in_srgb,var(--salary)_16%,transparent),transparent_60%),radial-gradient(40rem_18rem_at_100%_100%,color-mix(in_srgb,var(--remain)_14%,transparent),transparent_60%)]" />
      {COINS.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="animate-coin pointer-events-none absolute hidden place-items-center rounded-full border-2 border-salary/30 bg-salary/10 font-bold text-salary/50 sm:grid"
          style={{ right: c.right, top: c.top, width: c.size, height: c.size, fontSize: c.size * 0.45, ["--dur" as string]: `${c.dur}s`, ["--delay" as string]: `${c.delay}s` }}
        >
          ₹
        </span>
      ))}

      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid min-w-0 gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-salary/15 text-salary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <h2 id="salary-hero-title" className="text-base font-semibold">Salary vs spending</h2>
            <span className="rounded-full border bg-card/70 px-2 py-0.5 text-xs text-muted-foreground">{periodLabel}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="How salary is worked out">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Salary is monthly: the income you record under the Salary category, or else the salary set for that month on the Budgets
                page. A period counts the months that start inside it. Spent includes every expense, including event spending.
              </TooltipContent>
            </Tooltip>
          </div>

          {loading || !flows ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1 border-l-2 border-salary pl-3">
                <dt className="text-sm text-muted-foreground">Salary</dt>
                <dd className="text-2xl font-semibold tracking-tight text-salary sm:text-3xl">
                  <AnimatedMoney value={flows.salary} data-testid="kpi-salary" />
                </dd>
              </div>
              <div className="grid gap-1 border-l-2 border-spend pl-3">
                <dt className="text-sm text-muted-foreground">Spent</dt>
                <dd className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  <AnimatedMoney value={flows.expenses} data-testid="kpi-spent" />
                </dd>
              </div>
              <div className="grid gap-1 border-l-2 border-remain pl-3">
                <dt className="text-sm text-muted-foreground">{over ? "Over salary by" : "Remaining"}</dt>
                <dd className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", over ? "text-negative" : "text-remain")}>
                  <AnimatedMoney value={flows.remaining} data-testid="kpi-remaining" />
                </dd>
              </div>
            </dl>
          )}

          {flows && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {point && <span className="rounded-full border bg-card/70 px-2.5 py-1">Salary {SOURCE[point.salary_source]}</span>}
              {!month && <span className="rounded-full border bg-card/70 px-2.5 py-1">Salary of the months that start in this period</span>}
              {!isZero(flows.other_income) && <span className="rounded-full border bg-card/70 px-2.5 py-1">Other income {formatMoney(flows.other_income)}</span>}
              {carried && <span className="rounded-full border bg-card/70 px-2.5 py-1">+{formatMoney(carried)} carried from last month</span>}
              {noSalary && (
                <Button asChild size="sm" variant="outline" className="h-7 rounded-full">
                  <Link href="/budgets/">
                    Set your salary <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 md:flex-col">
          <RingProgress
            value={pct}
            color={pct !== null && pct >= 100 ? "var(--destructive)" : pct !== null && pct >= 85 ? "var(--warning)" : "var(--spend)"}
            label={pct === null ? "No salary to compare with" : `${pct.toFixed(0)}% of salary spent`}
          >
            <div>
              <p className="num text-2xl font-semibold">{pct === null ? "—" : `${Math.round(pct)}%`}</p>
              <p className="text-[11px] text-muted-foreground">{pct === null ? "no salary" : "of salary spent"}</p>
            </div>
          </RingProgress>
          {month && <p className="text-xs text-muted-foreground md:text-center">{formatMonth(month)}</p>}
        </div>
      </div>
    </Card>
  );
}
