"use client";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CheckCheck, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ConfirmAction, ErrorState, LoadingRows, StatCard } from "@/components/common";
import { FormDialog } from "@/components/form-dialog";
import { MoveForm } from "@/components/move-form";
import { ReturnAllForm } from "@/components/return-all";
import { AmountCell } from "@/components/transactions-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatMoney, isZero } from "@/lib/money";
import { type Txn, useCustody, useFinanceMutation } from "@/lib/queries";

function Detail({ id }: { id: number }) {
  const q = useCustody(id);
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "deposit" | "return" | "return-all" | "delete">(null);
  const [deleting, setDeleting] = useState<Txn | null>(null);
  const delTxn = useFinanceMutation((t: Txn) => api.delete(`/custody/${id}/transactions/${t.id}`), { success: "Entry deleted" });
  const delAll = useFinanceMutation(() => api.delete(`/custody/${id}`), { success: "Record deleted" });

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingRows rows={5} />;
  const c = q.data;

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/custody/"><ArrowLeft /> Held for others</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{c.counterparty.name}</h1>
              {c.is_settled ? <Badge variant="secondary">Fully returned</Badge> : c.overdue ? <Badge variant="destructive">Past return date</Badge> : <Badge variant="outline">Holding</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.purpose}
              {c.expected_return_date && ` · return by ${formatDate(c.expected_return_date)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog("deposit")}><ArrowDownLeft /> Received more</Button>
            <Button onClick={() => setDialog("return-all")} disabled={isZero(c.held)} title={isZero(c.held) ? "Nothing left to return" : undefined}>
              <CheckCheck /> Return completely
            </Button>
            <Button variant="outline" onClick={() => setDialog("return")} disabled={isZero(c.held)}><ArrowUpRight /> Return part</Button>
            <Button variant="ghost" size="icon" aria-label="Delete record" onClick={() => setDialog("delete")}><Trash2 /></Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
        <StatCard label="Still holding" value={c.held} />
        <StatCard label="Received" value={c.received} />
        <StatCard label="Returned" value={c.returned} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell>
                    {t.kind === "custody_in" ? "Received" : "Returned"}
                    {t.notes && <span className="block max-w-64 truncate text-xs text-muted-foreground">{t.notes}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.account?.name ?? "—"}</TableCell>
                  <TableCell className="text-right"><AmountCell t={t} /></TableCell>
                  <TableCell>
                    {c.transactions.length > 1 && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete entry of ${formatMoney(t.amount)}`} onClick={() => setDeleting(t)}><Trash2 /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {c.notes && <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
        </CardContent>
      </Card>

      <FormDialog open={dialog === "deposit"} onOpenChange={(o) => !o && setDialog(null)} title={`Received more from ${c.counterparty.name}`}>
        <MoveForm endpoint={`/custody/${id}/deposits`} accountLabel="Held in account" submitLabel="Record" success="Deposit recorded" onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "return-all"} onOpenChange={(o) => !o && setDialog(null)} title={`Return everything to ${c.counterparty.name}?`}>
        <ReturnAllForm record={c} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "return"} onOpenChange={(o) => !o && setDialog(null)} title={`Return part of the money to ${c.counterparty.name}`}>
        <MoveForm endpoint={`/custody/${id}/returns`} accountLabel="Paid from account" submitLabel="Record return" success="Return recorded" max={c.held} onDone={() => setDialog(null)} />
      </FormDialog>
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this record?"
        description="All deposits and returns in this record are removed from balances. A record is kept in the audit log."
        onConfirm={async () => {
          await delAll.mutateAsync(undefined);
          router.replace("/custody/");
        }}
      />
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${deleting.kind === "custody_in" ? "Deposit" : "Return"} of ${formatMoney(deleting.amount)} on ${formatDate(deleting.date)}.` : ""}
        onConfirm={() => delTxn.mutateAsync(deleting!)}
      />
    </div>
  );
}

function Inner() {
  const id = Number(useSearchParams().get("id"));
  return id ? <Detail id={id} /> : <ErrorState error={new Error("No record selected")} />;
}

export default function CustodyViewPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 size-6 animate-spin text-muted-foreground" />}>
      <Inner />
    </Suspense>
  );
}
