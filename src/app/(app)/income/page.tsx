"use client";

import { Info, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PageHeader } from "@/components/common";
import { LedgerView } from "@/components/ledger-view";
import { PlanSection } from "@/components/planning";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "income" | "salary";

function IncomeTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "salary" ? "salary" : "income";
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Income"
        description="Salary, freelance earnings, interest and other money you received. Business income is kept on each business's page."
        actions={
          tab === "salary" ? (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Set monthly salary
            </Button>
          ) : undefined
        }
      />
      <Tabs value={tab} onValueChange={(t) => router.replace(t === "salary" ? "/income/?tab=salary" : "/income/", { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="income">All income</TabsTrigger>
          <TabsTrigger value="salary">Monthly salary</TabsTrigger>
        </TabsList>
        <TabsContent value="income">
          <LedgerView fixedKind="income" />
        </TabsContent>
        <TabsContent value="salary">
          <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Each month shows your salary, what you spent that month (event spending included) and what&apos;s left. Setting a salary here never
              creates a transaction. If you record your salary as income under the Salary category, that recorded amount is used for the month
              instead, so salary is never counted twice. You don&apos;t need a salary to record or analyse other transactions.
            </span>
          </p>
          <PlanSection scope="monthly" creating={creating} onCreatingChange={setCreating} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={null}>
      <IncomeTabs />
    </Suspense>
  );
}
