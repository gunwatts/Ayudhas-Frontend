"use client";

import { PageHeader } from "@/components/common";
import { LedgerView } from "@/components/ledger-view";
import { QuickBar } from "@/components/quick-transactions";

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" description="Every movement of money across your accounts, loans, custody and investments." />
      <div className="mb-6">
        <QuickBar />
      </div>
      <LedgerView />
    </>
  );
}
