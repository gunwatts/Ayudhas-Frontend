"use client";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, LineChart, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { ConfirmAction, ErrorState, LoadingRows, StatCard } from "@/components/common";
import { AmountInput, Field } from "@/components/fields";
import { FormDialog, FormError } from "@/components/form-dialog";
import { INVESTMENT_TYPES, InvestmentForm } from "@/components/investment-form";
import { MoveForm } from "@/components/move-form";
import { AmountCell } from "@/components/transactions-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, applyFieldErrors } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { formatMoney, normalizeAmount } from "@/lib/money";
import { type InvestmentDetail, type Txn, useFinanceMutation, useInvestment } from "@/lib/queries";

function ValuationForm({ inv, onDone }: { inv: InvestmentDetail; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { as_of: today(), value: "", note: "" } });
  const save = useFinanceMutation((v: { as_of: string; value: string; note: string }) => api.post(`/investments/${inv.id}/valuations`, { ...v, value: normalizeAmount(v.value) }), {
    success: "Valuation saved",
    silentError: true,
  });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalizeAmount(v.value))) return form.setError("value", { message: "Enter the current value" });
        setError(null);
        try {
          await save.mutateAsync(v);
          onDone();
        } catch (err) {
          setError(applyFieldErrors(err, form.setError as never, ["as_of", "value"]));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Market value" required error={form.formState.errors.value?.message}>
          {({ id }) => <AmountInput id={id} autoFocus {...form.register("value")} />}
        </Field>
        <Field label="As of">{({ id }) => <Input id={id} type="date" {...form.register("as_of")} />}</Field>
      </div>
      <Field label="Source / note" hint="e.g. “CAMS statement” — a value entered for an existing date replaces it">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} {...form.register("note")} />}
      </Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save valuation"}</Button>
      </div>
    </form>
  );
}

function Detail({ id }: { id: number }) {
  const q = useInvestment(id);
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "buy" | "sell" | "value" | "edit" | "delete">(null);
  const [deleting, setDeleting] = useState<Txn | null>(null);
  const delTxn = useFinanceMutation((t: Txn) => api.delete(`/investments/${id}/transactions/${t.id}`), { success: "Entry deleted" });
  const delVal = useFinanceMutation((vid: number) => api.delete(`/investments/${id}/valuations/${vid}`), { success: "Valuation removed" });
  const delInv = useFinanceMutation(() => api.delete(`/investments/${id}`), { success: "Investment deleted" });
  const toggleClosed = useFinanceMutation((closed: boolean) => api.patch(`/investments/${id}`, { is_closed: closed }), { success: "Investment updated" });

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingRows rows={5} />;
  const inv = q.data;

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/investments/"><ArrowLeft /> Investments</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{inv.name}</h1>
              {inv.is_closed && <Badge variant="secondary">Closed</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label}
              {inv.institution && ` · ${inv.institution}`}
              {inv.maturity_date && ` · matures ${formatDate(inv.maturity_date)}`}
              {inv.expected_rate && ` · expected ${Number(inv.expected_rate)}% p.a.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("buy")}><ArrowUpRight /> Invest</Button>
            <Button variant="outline" onClick={() => setDialog("sell")}><ArrowDownLeft /> Withdraw</Button>
            <Button variant="outline" onClick={() => setDialog("value")}><LineChart /> Update value</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog("edit")}><Pencil /> Edit details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleClosed.mutate(!inv.is_closed)}>{inv.is_closed ? "Reopen" : "Mark as closed"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invested principal" value={inv.invested_principal} hint={`Contributed ${formatMoney(inv.contributed)} in total`} />
        <StatCard label="Current value" value={inv.current_value ?? inv.invested_principal} hint={inv.valuation_date ? `As of ${formatDate(inv.valuation_date)} (your entry)` : "No valuation yet — shown at cost"} />
        <StatCard label="Unrealized gain" value={inv.unrealized_gain} tone="auto" hint="Estimate from your latest valuation" />
        <StatCard label="Realized gain" value={inv.realized_gain} tone="auto" hint={`Withdrawn ${formatMoney(inv.withdrawn)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Contributions & withdrawals</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {inv.transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing invested yet.</p>
            ) : (
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
                  {inv.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>
                        {t.kind === "investment_buy" ? "Invested" : "Withdrawn"}
                        {t.kind === "investment_sell" && <span className="block text-xs text-muted-foreground">cost {formatMoney(t.principal_portion)}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.account?.name ?? "—"}</TableCell>
                      <TableCell className="text-right"><AmountCell t={t} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => setDeleting(t)}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Valuation history</CardTitle></CardHeader>
          <CardContent>
            {inv.valuations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Record the value from your statement to track gains.</p>
            ) : (
              <ul className="divide-y">
                {inv.valuations.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="flex-1">
                      <p>{formatDate(v.as_of)}</p>
                      {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
                    </div>
                    <span className="num font-medium">{formatMoney(v.value)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove valuation of ${formatDate(v.as_of)}`} onClick={() => delVal.mutate(v.id)}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <FormDialog open={dialog === "buy"} onOpenChange={(o) => !o && setDialog(null)} title="Invest money" description="Moves money from an account into this investment. Not counted as an expense.">
        <MoveForm endpoint={`/investments/${id}/contributions`} accountLabel="Paid from account" submitLabel="Record investment" success="Contribution recorded" onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "sell"} onOpenChange={(o) => !o && setDialog(null)} title="Withdraw / redeem" description="Money returned to your account. Gains are tracked separately, not as income.">
        <MoveForm endpoint={`/investments/${id}/withdrawals`} accountLabel="Received into account" submitLabel="Record withdrawal" success="Withdrawal recorded" costBasis={{ invested: inv.invested_principal }} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "value"} onOpenChange={(o) => !o && setDialog(null)} title="Update market value">
        <ValuationForm inv={inv} onDone={() => setDialog(null)} />
      </FormDialog>
      <FormDialog open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} title="Edit investment" wide>
        <InvestmentForm initial={inv} onDone={() => setDialog(null)} />
      </FormDialog>
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Delete ${inv.name}?`}
        description="Only investments without contributions or withdrawals can be deleted. Mark it as closed to keep its history."
        onConfirm={async () => {
          await delInv.mutateAsync(undefined);
          router.replace("/investments/");
        }}
      />
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${deleting.kind_label} of ${formatMoney(deleting.amount)} on ${formatDate(deleting.date)}.` : ""}
        onConfirm={() => delTxn.mutateAsync(deleting!)}
      />
    </div>
  );
}

function Inner() {
  const id = Number(useSearchParams().get("id"));
  return id ? <Detail id={id} /> : <ErrorState error={new Error("No investment selected")} />;
}

export default function InvestmentViewPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 size-6 animate-spin text-muted-foreground" />}>
      <Inner />
    </Suspense>
  );
}
