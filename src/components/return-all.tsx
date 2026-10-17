"use client";

import { useState } from "react";

import { AccountSelect, Field } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, applyFieldErrors, newIdempotencyKey } from "@/lib/api";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { type CustodyDetail, useFinanceMutation } from "@/lib/queries";

/**
 * Confirm and return everything still held for someone, in one entry. The server works out the amount under a
 * lock and refuses if it no longer matches what is shown here, and the idempotency key makes a double tap or a
 * retry record the return only once.
 */
export function ReturnAllForm({ record, onDone }: { record: CustodyDetail; onDone: () => void }) {
  const [key] = useState(newIdempotencyKey);
  // Default to the account the money came into (the most recent deposit's), so it goes back the same way.
  const lastDeposit = record.transactions.find((t) => t.kind === "custody_in" && t.account);
  const [accountId, setAccountId] = useState(lastDeposit?.account ? String(lastDeposit.account.id) : "");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const save = useFinanceMutation(
    () => api.post(`/custody/${record.id}/return-all`, { date, account_id: accountId ? Number(accountId) : null, expected_amount: record.held }, key),
    { success: `Returned ${formatMoney(record.held)} to ${record.counterparty.name}`, silentError: true },
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await save.mutateAsync(undefined);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, () => {}, []));
        }
      }}
    >
      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="text-muted-foreground">Amount still to return</p>
        <p className="num text-2xl font-semibold tracking-tight">{formatMoney(record.held)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Received {formatMoney(record.received)} · already returned {formatMoney(record.returned)}. After this the record is marked fully returned; its history is kept.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid from account">{({ id }) => <AccountSelect id={id} value={accountId} onChange={setAccountId} />}</Field>
        <Field label="Date">{({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || !date}>
          {save.isPending ? "Returning…" : `Return ${formatMoney(record.held)}`}
        </Button>
      </div>
    </form>
  );
}
