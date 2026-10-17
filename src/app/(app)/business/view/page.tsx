"use client";

import { Archive, ArchiveRestore, ArrowDownLeft, ArrowLeft, ArrowUpRight, FolderKanban, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BusinessForm, categoryLabel, ProjectForm, statusLabel } from "@/components/business-forms";
import { CompareChart } from "@/components/charts";
import { ConfirmAction, EmptyState, ErrorState, LoadingRows, Money, StatCard } from "@/components/common";
import { NONE } from "@/components/fields";
import { FormDialog } from "@/components/form-dialog";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionsList } from "@/components/transactions-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, RANGE_LABELS } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { type BusinessReport, type Project, useBusinessReport, useFinanceMutation, useProjects, useTransactions } from "@/lib/queries";

type Adding = { kind: "income" | "expense"; projectId?: number } | null;

function CategoryList({ title, rows, empty }: { title: string; rows: BusinessReport["expense_by_category"]; empty: string }) {
  const total = rows.reduce((t, r) => t + Number(r.total), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="grid gap-2.5">
            {rows.map((r) => {
              const pct = total > 0 ? (Number(r.total) / total) * 100 : 0;
              return (
                <li key={r.category_id ?? "none"} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="num shrink-0 font-medium">{formatMoney(r.total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectMenu({ p, onEdit, onAdd }: { p: Project; onEdit: () => void; onAdd: (kind: "income" | "expense") => void }) {
  const [confirm, setConfirm] = useState(false);
  const del = useFinanceMutation(() => api.delete(`/projects/${p.id}`), { success: "Project deleted" });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onAdd("expense")}><ArrowUpRight /> Add project expense</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdd("income")}><ArrowDownLeft /> Add project income</DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit project</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${p.name}?`}
        description="Only a project without transactions can be deleted. Mark it completed to keep its history."
        onConfirm={() => del.mutateAsync(undefined)}
      />
    </>
  );
}

function Detail({ id }: { id: number }) {
  const [period, setPeriod] = usePeriod("this_year");
  const report = useBusinessReport(id, period.start, period.end);
  const projects = useProjects(id);
  const router = useRouter();
  const [adding, setAdding] = useState<Adding>(null);
  const [editing, setEditing] = useState(false);
  const [projectDialog, setProjectDialog] = useState<Project | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [txnFilter, setTxnFilter] = useState<string>(NONE);
  const txns = useTransactions({
    business_id: id,
    project_id: txnFilter === NONE ? undefined : Number(txnFilter),
    start: period.start,
    end: period.end,
    sort: "-date",
    page_size: 100,
  });
  const archive = useFinanceMutation((v: boolean) => api.patch(`/businesses/${id}`, { is_archived: v }), { success: (r) => ((r as { is_archived: boolean }).is_archived ? "Business archived" : "Business restored") });
  const del = useFinanceMutation(() => api.delete(`/businesses/${id}`), { success: "Business deleted" });

  if (report.error && !report.data) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (!report.data) return <LoadingRows rows={6} />;
  const r = report.data;
  const b = r.business;
  const label = period.preset === "custom" ? `${formatDate(period.start)} – ${formatDate(period.end)}` : RANGE_LABELS[period.preset];
  const projectRows = r.projects;

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/business/"><ArrowLeft /> Businesses</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{b.name}</h1>
              {b.is_archived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryLabel(b.category)}
              {b.gstin && ` · GSTIN ${b.gstin}`}
              {b.description && ` · ${b.description}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            {!b.is_archived && (
              <>
                <Button variant="outline" onClick={() => setAdding({ kind: "income" })}><ArrowDownLeft /> Income</Button>
                <Button onClick={() => setAdding({ kind: "expense" })}><ArrowUpRight /> Expense</Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions for this business"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil /> Edit details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => archive.mutate(!b.is_archived)}>
                  {b.is_archived ? <ArchiveRestore /> : <Archive />} {b.is_archived ? "Restore" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label={`${b.name}, ${label}`}>
        <StatCard label="Income" value={r.totals.income} accent="salary" />
        <StatCard label="Operating costs" value={r.totals.operating_expenses} accent="spend" hint="Business-wide: rent, bills, salaries" />
        <StatCard label="Project costs" value={r.totals.project_expenses} accent="gold" hint="Linked to a project" />
        <StatCard label={Number(r.totals.profit) < 0 ? "Loss" : "Profit"} value={r.totals.profit} tone="auto" accent="remain" hint={label} />
        <StatCard label="Account balance" value={r.balance} accent="violet" hint={<Link href="/accounts/" className="hover:underline">Accounts linked to {b.name}</Link>} className="col-span-2 lg:col-span-1" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income vs costs, last 12 months</CardTitle>
          <CardDescription>Profit each month. Transfers, loans and balance adjustments are never counted as income or costs.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompareChart rows={r.trend.map((p) => ({ key: p.month, label: p.month, a: p.income, b: p.expenses }))} aLabel="Income" bLabel="Costs" netLabel="Profit" emptyLabel="Nothing recorded for this business yet." />
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-label="Projects">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Projects</h2>
          {!b.is_archived && <Button size="sm" variant="outline" onClick={() => setProjectDialog("new")}><Plus /> Add project</Button>}
        </div>
        {projectRows.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Add a project for each job or order to see its own costs (materials, labour) and profit." />
        ) : (
          <>
            <Card>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRows.map((p) => {
                      const full = projects.data?.find((x) => x.id === p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="font-medium">{p.name}</span>
                            {p.client && <span className="block text-xs text-muted-foreground">{p.client}</span>}
                          </TableCell>
                          <TableCell><Badge variant={p.status === "active" ? "outline" : "secondary"}>{statusLabel(p.status)}</Badge></TableCell>
                          <TableCell className="text-right"><Money value={p.income} /></TableCell>
                          <TableCell className="text-right"><Money value={p.expenses} /></TableCell>
                          <TableCell className="text-right">{p.has_data ? <Money value={p.profit} tone="auto" className="font-medium" /> : <span className="text-xs text-muted-foreground">No entries</span>}</TableCell>
                          <TableCell>
                            {full && <ProjectMenu p={full} onEdit={() => setProjectDialog(full)} onAdd={(kind) => setAdding({ kind, projectId: p.id })} />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {projectRows.some((p) => p.has_data) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Project-wise income and costs</CardTitle>
                  <CardDescription>{label}. Business-wide operating costs are not split across projects.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CompareChart
                    monthly={false}
                    rows={projectRows.filter((p) => p.has_data).map((p) => ({ key: String(p.id), label: p.name, a: p.income, b: p.expenses }))}
                    aLabel="Income"
                    bLabel="Costs"
                    netLabel="Profit"
                    height={240}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryList title="Costs by category" rows={r.expense_by_category} empty="No costs in this period" />
        <CategoryList title="Income by category" rows={r.income_by_category} empty="No income in this period" />
      </div>

      <section className="grid gap-3" aria-label="Business transactions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Transactions</h2>
          <Select value={txnFilter} onValueChange={setTxnFilter}>
            <SelectTrigger className="w-56" aria-label="Show transactions for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Whole business</SelectItem>
              <SelectItem value="0">Business-wide only (no project)</SelectItem>
              {projects.data?.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {txns.error && !txns.data ? (
          <ErrorState error={txns.error} onRetry={() => txns.refetch()} />
        ) : !txns.data ? (
          <LoadingRows rows={4} />
        ) : (
          <TransactionsList items={txns.data.items} emptyTitle="Nothing recorded in this period" emptyDescription="Use Income or Expense above to record business money." />
        )}
      </section>

      <FormDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title={adding?.kind === "income" ? `Business income: ${b.name}` : `Business expense: ${b.name}`}>
        {adding && <TransactionForm defaultKind={adding.kind} defaultBusinessId={id} defaultProjectId={adding.projectId} onDone={() => setAdding(null)} />}
      </FormDialog>
      <FormDialog open={editing} onOpenChange={setEditing} title="Edit business">
        <BusinessForm initial={b} onDone={() => setEditing(false)} />
      </FormDialog>
      <FormDialog open={projectDialog !== null} onOpenChange={(o) => !o && setProjectDialog(null)} title={projectDialog === "new" ? "Add project" : "Edit project"}>
        {projectDialog !== null && <ProjectForm businessId={id} initial={projectDialog === "new" ? undefined : projectDialog} onDone={() => setProjectDialog(null)} />}
      </FormDialog>
      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${b.name}?`}
        description="Only a business without transactions can be deleted. Archive it to keep its history and reports."
        onConfirm={async () => {
          await del.mutateAsync(undefined);
          router.replace("/business/");
        }}
      />
    </div>
  );
}

function Inner() {
  const id = Number(useSearchParams().get("id"));
  return id ? <Detail id={id} /> : <ErrorState error={new Error("No business selected")} />;
}

export default function BusinessViewPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 size-6 animate-spin text-muted-foreground" />}>
      <Inner />
    </Suspense>
  );
}
