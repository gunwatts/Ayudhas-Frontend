"use client";

import { ChevronRight, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingRows, Money, PageHeader, StatCard } from "@/components/common";
import { FormDialog } from "@/components/form-dialog";
import { INVESTMENT_TYPES, InvestmentForm } from "@/components/investment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { addMoney, isNegative, subMoney, toNumber } from "@/lib/money";
import { type Investment, useInvestments } from "@/lib/queries";

function InvestmentRow({ i }: { i: Investment }) {
  const gain = i.unrealized_gain;
  return (
    <Link href={`/investments/view/?id=${i.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{i.name}</p>
          {i.is_closed && <Badge variant="secondary">Closed</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {INVESTMENT_TYPES.find((t) => t.value === i.type)?.label}
          {i.institution && ` · ${i.institution}`}
          {i.valuation_date ? ` · valued ${formatDate(i.valuation_date)}` : " · no valuation yet"}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs text-muted-foreground">Invested</p>
        <Money value={i.invested_principal} className="text-sm" />
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Value</p>
        <Money value={i.current_value ?? i.invested_principal} className="text-sm font-medium" />
        {gain !== null && gain !== undefined && (
          <p className={`num text-xs ${isNegative(gain) ? "text-negative" : "text-positive"}`}>
            {isNegative(gain) ? "" : "+"}
            <Money value={gain} />
          </p>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

export default function InvestmentsPage() {
  const list = useInvestments();
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const items = list.data ?? [];
  const invested = addMoney(...items.map((i) => i.invested_principal));
  const value = addMoney(...items.map((i) => i.current_value ?? i.invested_principal));
  const realized = addMoney(...items.map((i) => i.realized_gain));
  const unvalued = items.filter((i) => i.current_value === null && toNumber(i.invested_principal) > 0).length;

  return (
    <>
      <PageHeader
        title="Investments"
        description="Contributions, withdrawals and the values you record. Prices are not fetched automatically."
        actions={<Button onClick={() => setCreating(true)}><Plus /> Add investment</Button>}
      />
      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Invested" value={invested} hint="Principal still invested" />
            <StatCard label="Current value" value={value} hint={unvalued ? `${unvalued} at cost (no valuation)` : "From your latest valuations"} />
            <StatCard label="Unrealized gain" value={subMoney(value, invested)} tone="auto" hint="Value − invested (estimate)" />
            <StatCard label="Realized gain" value={realized} tone="auto" hint="From withdrawals" />
          </div>
          {!items.length ? (
            <EmptyState icon={TrendingUp} title="No investments yet" description="Track FDs, mutual funds, stocks, gold and retirement savings." action={<Button onClick={() => setCreating(true)}><Plus /> Add investment</Button>} />
          ) : (
            <Card className="py-0">
              <CardContent className="divide-y px-0">{items.map((i) => <InvestmentRow key={i.id} i={i} />)}</CardContent>
            </Card>
          )}
        </div>
      )}
      <FormDialog open={creating} onOpenChange={setCreating} title="Add investment" wide>
        <InvestmentForm onDone={(i) => { setCreating(false); router.push(`/investments/view/?id=${i.id}`); }} />
      </FormDialog>
    </>
  );
}
