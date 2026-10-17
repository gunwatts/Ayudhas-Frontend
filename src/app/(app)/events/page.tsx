"use client";

import { Info, Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/common";
import { PlanSection } from "@/components/planning";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "event" | "custom";

export default function EventsPage() {
  const [tab, setTab] = useState<Tab>("event");
  const [creating, setCreating] = useState<Tab | null>(null);
  return (
    <>
      <PageHeader
        title="Events"
        description="Group the spending of a wedding, a trip or a festival, and plan what you'll spend over a period. Neither creates transactions."
        actions={
          <Button onClick={() => setCreating(tab)}>
            <Plus /> {tab === "event" ? "New event" : "New spending plan"}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(t) => setTab(t as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="event">Events</TabsTrigger>
          <TabsTrigger value="custom">Spending plans</TabsTrigger>
        </TabsList>
        <TabsContent value="event">
          <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            An event groups related expenses. Each expense also counts once in the month of its date; the event itself is never an extra expense.
          </p>
          <PlanSection scope="event" creating={creating === "event"} onCreatingChange={(o) => setCreating(o ? "event" : null)} />
        </TabsContent>
        <TabsContent value="custom">
          <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            A spending plan sets how much you mean to spend between two dates and tracks every personal expense in that period.
          </p>
          <PlanSection scope="custom" creating={creating === "custom"} onCreatingChange={(o) => setCreating(o ? "custom" : null)} />
        </TabsContent>
      </Tabs>
    </>
  );
}
