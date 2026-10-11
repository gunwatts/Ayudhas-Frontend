"use client";

import { PageHeader } from "@/components/common";
import { LedgerView } from "@/components/ledger-view";

export default function IncomePage() {
  return (
    <>
      <PageHeader title="Income" description="Salary, bonuses, interest and other money you earned." />
      <LedgerView fixedKind="income" />
    </>
  );
}
