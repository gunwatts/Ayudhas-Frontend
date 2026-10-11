"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, ApiError, type Schemas } from "./api";

export type Txn = Schemas["TransactionOut"];
export type Account = Schemas["AccountOut"];
export type Category = Schemas["CategoryOut"];
export type Person = Schemas["CounterpartyOut"];
export type Loan = Schemas["LoanOut"];
export type LoanDetail = Schemas["LoanDetailOut"];
export type Custody = Schemas["CustodyOut"];
export type CustodyDetail = Schemas["CustodyDetailOut"];
export type Investment = Schemas["InvestmentOut"];
export type InvestmentDetail = Schemas["InvestmentDetailOut"];
export type Budget = Schemas["BudgetOut"];
export type Goal = Schemas["GoalOut"];
export type Recurring = Schemas["RecurringOut"];
export type Dashboard = Schemas["DashboardOut"];
export type Positions = Schemas["Positions"];
export type Flows = Schemas["Flows"];
export type TrendPoint = Schemas["TrendPoint"];
export type CategoryTotal = Schemas["CategoryTotal"];
export type Note = Schemas["NoteOut"];
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type TxnFilters = {
  kind?: string[];
  account_id?: number;
  category_id?: number;
  counterparty_id?: number;
  event_id?: number;
  start?: string;
  end?: string;
  q?: string;
  sort?: string;
  page?: number;
  page_size?: number;
};

/** Every financial figure depends on the ledger, so any money mutation refreshes all finance data. */
export function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" });
}

export function useFinanceMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); silentError?: boolean } = {},
) {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await invalidate();
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
    },
    onError: (error) => {
      if (opts.silentError) return;
      if (error instanceof ApiError && error.details.length) return; // shown inline by the form
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    },
  });
}

export const useDashboard = (start?: string, end?: string) =>
  useQuery({
    queryKey: ["dashboard", start, end],
    queryFn: ({ signal }) => api.get<Dashboard>("/dashboard", { start, end }, signal),
    placeholderData: keepPreviousData,
  });

export const usePositions = () =>
  useQuery({ queryKey: ["positions"], queryFn: ({ signal }) => api.get<Positions>("/reports/positions", {}, signal) });

export const useFlows = (start: string, end: string) =>
  useQuery({
    queryKey: ["flows", start, end],
    queryFn: ({ signal }) => api.get<Flows>("/reports/flows", { start, end }, signal),
    placeholderData: keepPreviousData,
  });

export const useTrend = (months: number) =>
  useQuery({
    queryKey: ["trend", months],
    queryFn: ({ signal }) => api.get<TrendPoint[]>("/reports/trend", { months }, signal),
  });

export const useCategoryTotals = (start: string, end: string, kind: "expense" | "income") =>
  useQuery({
    queryKey: ["category-totals", start, end, kind],
    queryFn: ({ signal }) => api.get<CategoryTotal[]>("/reports/categories", { start, end, kind }, signal),
    placeholderData: keepPreviousData,
  });

export const useCompare = (period: "month" | "quarter" | "year") =>
  useQuery({
    queryKey: ["compare", period],
    queryFn: ({ signal }) => api.get<Schemas["PeriodComparison"]>("/reports/compare", { period }, signal),
  });

export const useTransactions = (filters: TxnFilters) =>
  useQuery({
    queryKey: ["transactions", filters],
    queryFn: ({ signal }) => api.get<Page<Txn>>("/transactions", filters as Record<string, string>, signal),
    placeholderData: keepPreviousData,
  });

export const useAccounts = (includeArchived = false) =>
  useQuery({
    queryKey: ["accounts", includeArchived],
    queryFn: ({ signal }) => api.get<Account[]>("/accounts", { include_archived: includeArchived }, signal),
  });

export const useCategories = (kind?: "expense" | "income", includeArchived = false) =>
  useQuery({
    queryKey: ["categories", kind, includeArchived],
    queryFn: ({ signal }) => api.get<Category[]>("/categories", { kind, include_archived: includeArchived }, signal),
    staleTime: 60_000,
  });

export const usePeople = () =>
  useQuery({ queryKey: ["people"], queryFn: ({ signal }) => api.get<Person[]>("/people", {}, signal) });

export const useLoans = (direction: "taken" | "given") =>
  useQuery({
    queryKey: ["loans", direction],
    queryFn: ({ signal }) => api.get<Loan[]>("/loans", { direction }, signal),
  });

export const useLoan = (id: number | null) =>
  useQuery({
    queryKey: ["loan", id],
    queryFn: ({ signal }) => api.get<LoanDetail>(`/loans/${id}`, {}, signal),
    enabled: !!id,
  });

export const useCustodyList = () =>
  useQuery({ queryKey: ["custody"], queryFn: ({ signal }) => api.get<Custody[]>("/custody", {}, signal) });

export const useCustody = (id: number | null) =>
  useQuery({
    queryKey: ["custody-detail", id],
    queryFn: ({ signal }) => api.get<CustodyDetail>(`/custody/${id}`, {}, signal),
    enabled: !!id,
  });

export const useInvestments = () =>
  useQuery({ queryKey: ["investments"], queryFn: ({ signal }) => api.get<Investment[]>("/investments", {}, signal) });

export const useInvestment = (id: number | null) =>
  useQuery({
    queryKey: ["investment", id],
    queryFn: ({ signal }) => api.get<InvestmentDetail>(`/investments/${id}`, {}, signal),
    enabled: !!id,
  });

export const useBudgets = (scope?: string) =>
  useQuery({
    queryKey: ["budgets", scope],
    queryFn: ({ signal }) => api.get<Budget[]>("/budgets", { scope }, signal),
  });

export const useBudget = (id: number | null) =>
  useQuery({
    queryKey: ["budget", id],
    queryFn: ({ signal }) => api.get<Budget>(`/budgets/${id}`, {}, signal),
    enabled: !!id,
  });

export const useGoals = () =>
  useQuery({ queryKey: ["goals"], queryFn: ({ signal }) => api.get<Goal[]>("/goals", {}, signal) });

export const useRecurring = () =>
  useQuery({ queryKey: ["recurring"], queryFn: ({ signal }) => api.get<Recurring[]>("/recurring", {}, signal) });

export const useNotes = () =>
  useQuery({ queryKey: ["notes"], queryFn: ({ signal }) => api.get<Note[]>("/notes", {}, signal) });
