"use client";

import { ArrowRight, Briefcase, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BusinessForm, categoryLabel } from "@/components/business-forms";
import { CompareChart } from "@/components/charts";
import { EmptyState, ErrorState, LoadingRows, Money, PageHeader, StatCard } from "@/components/common";
import { FormDialog } from "@/components/form-dialog";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, RANGE_LABELS } from "@/lib/dates";
import { useBusinesses, useBusinessOverview } from "@/lib/queries";

export default function BusinessesPage() {
  const [period, setPeriod] = usePeriod("this_month");
  const list = useBusinesses();
  const overview = useBusinessOverview(period.start, period.end);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const label = period.preset === "custom" ? `${formatDate(period.start)} – ${formatDate(period.end)}` : RANGE_LABELS[period.preset];
  const t = overview.data?.totals;
  const rows = new Map(overview.data?.businesses.map((b) => [b.id, b]) ?? []);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Businesses & projects"
        description="Business income and costs, project by project. Kept apart from your personal income and spending."
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <Button onClick={() => setCreating(true)}>
              <Plus /> Add business
            </Button>
          </>
        }
      />

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <LoadingRows rows={3} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No business yet"
          description="Add your business to track its income, operating costs like rent and salaries, and the costs and profit of each project."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus /> Add business
            </Button>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label={`All businesses, ${label}`}>
            <StatCard label="Income" value={t?.income} accent="salary" loading={overview.isPending} />
            <StatCard label="Operating costs" value={t?.operating_expenses} accent="spend" loading={overview.isPending} hint="Rent, bills, salaries…" />
            <StatCard label="Project costs" value={t?.project_expenses} accent="gold" loading={overview.isPending} hint="Materials, labour…" />
            <StatCard label="Profit" value={t?.profit} tone="auto" accent="remain" loading={overview.isPending} />
            <StatCard label="Business accounts" value={overview.data?.business_cash} accent="violet" loading={overview.isPending} hint={<Link href="/accounts/" className="hover:underline">Link accounts</Link>} className="col-span-2 lg:col-span-1" />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income vs costs, last 12 months</CardTitle>
              <CardDescription>All businesses together. Profit is income minus costs.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompareChart
                rows={(overview.data?.trend ?? []).map((p) => ({ key: p.month, label: p.month, a: p.income, b: p.expenses }))}
                aLabel="Income"
                bLabel="Costs"
                netLabel="Profit"
                emptyLabel="No business income or costs recorded yet. Add them from a business below."
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data.map((b) => {
              const r = rows.get(b.id);
              return (
                <Link key={b.id} href={`/business/view/?id=${b.id}`} className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <Card className={`h-full transition-colors group-hover:border-primary/40 ${b.is_archived ? "opacity-60" : ""}`}>
                    <CardContent className="grid gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                            <Briefcase className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{b.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {categoryLabel(b.category)} · {b.project_count} project{b.project_count === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        {b.is_archived ? <Badge variant="secondary">Archived</Badge> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
                      </div>
                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Income</dt>
                          <dd className="truncate text-sm font-semibold"><Money value={r?.income ?? "0"} /></dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Costs</dt>
                          <dd className="truncate text-sm font-semibold"><Money value={r?.expenses ?? "0"} /></dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Profit</dt>
                          <dd className="truncate text-sm font-semibold"><Money value={r?.profit ?? "0"} tone="auto" /></dd>
                        </div>
                      </dl>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <FormDialog open={creating} onOpenChange={setCreating} title="Add business" description="Common business categories (rent, electricity, raw materials, labour, sales…) are added for you.">
        <BusinessForm
          onDone={(b) => {
            setCreating(false);
            router.push(`/business/view/?id=${b.id}`);
          }}
        />
      </FormDialog>
    </div>
  );
}
