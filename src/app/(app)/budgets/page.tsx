"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Old address: Budgets became Events (events and spending plans) and Income (monthly salary). */
export default function BudgetsRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/events/"), [router]);
  return <Loader2 className="mx-auto mt-20 size-6 animate-spin text-muted-foreground" aria-label="Opening Events" />;
}
