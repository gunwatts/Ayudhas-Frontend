"use client";

import { PageHeader } from "@/components/common";
import { LedgerView } from "@/components/ledger-view";

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" description="Every movement of money across your accounts, loans, custody and investments." />
      <LedgerView />
    </>
  );
}
