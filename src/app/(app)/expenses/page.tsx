"use client";

import { PageHeader } from "@/components/common";
import { LedgerView } from "@/components/ledger-view";

export default function ExpensesPage() {
  return (
    <>
      <PageHeader title="Expenses" description="What you spent, by category, merchant and account." />
      <LedgerView fixedKind="expense" />
    </>
  );
}
