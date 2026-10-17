import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompareChart } from "@/components/charts";
import { InfoTip } from "@/components/common";
import { QuickBar } from "@/components/quick-transactions";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionsList } from "@/components/transactions-list";
import type { Txn } from "@/lib/queries";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function routeFetch(handlers: Record<string, (init?: RequestInit) => unknown>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace("/api/v1", "");
    const handler = handlers[`${init?.method ?? "GET"} ${path}`];
    if (!handler) return new Response(JSON.stringify([]), { status: 200 });
    const out = handler(init) as { status?: number; body: unknown };
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const txn = (over: Partial<Txn>): Txn =>
  ({
    id: 1,
    kind: "expense",
    kind_label: "Expense",
    amount: "100.00",
    date: "2026-10-17",
    time: null,
    account: { id: 1, name: "SBI" },
    to_account: null,
    category: null,
    counterparty: null,
    event: null,
    business: null,
    project: null,
    loan_id: null,
    custody_id: null,
    investment_id: null,
    principal_portion: "0.00",
    interest_portion: "0.00",
    fee_portion: "0.00",
    description: "",
    merchant: "",
    payment_method: "",
    notes: "",
    version: 1,
    is_workflow: false,
    is_adjustment: false,
    reverses_id: null,
    reversed_by_id: null,
    can_undo: false,
    created_at: "2026-10-17T00:00:00Z",
    updated_at: "2026-10-17T00:00:00Z",
    ...over,
  }) as Txn;

describe("InfoTip", () => {
  it("opens on click (works for taps too) and closes with Escape or a second click", async () => {
    render(<InfoTip label="How this is calculated">Balances minus money held for others.</InfoTip>);
    const button = screen.getByRole("button", { name: "How this is calculated" });
    expect(screen.queryByText(/money held for others/)).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(await screen.findByText(/money held for others/)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText(/money held for others/)).not.toBeInTheDocument());
    await userEvent.click(button);
    expect(await screen.findByText(/money held for others/)).toBeVisible();
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryByText(/money held for others/)).not.toBeInTheDocument());
  });
});

describe("Balance adjustments in the transaction list", () => {
  it("offer Undo adjustment and never Edit or Delete", async () => {
    const fetchFn = routeFetch({ "POST /transactions/5/undo": () => ({ status: 201, body: { id: 6 } }) });
    wrap(<TransactionsList items={[txn({ id: 5, kind: "adjustment_in", kind_label: "Balance adjustment (+)", description: "Opening balance", is_adjustment: true, can_undo: true })]} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Opening balance" }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Undo adjustment" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo adjustment" }));
    await waitFor(() => expect(fetchFn.mock.calls.some(([u, init]) => String(u).endsWith("/transactions/5/undo") && init?.method === "POST")).toBe(true));
    const call = fetchFn.mock.calls.find(([u]) => String(u).endsWith("/undo"))!;
    expect((call[1]!.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
  });

  it("shows an undone adjustment with no actions", () => {
    routeFetch({});
    wrap(<TransactionsList items={[txn({ id: 5, kind: "adjustment_in", description: "Opening balance", is_adjustment: true, can_undo: false, reversed_by_id: 9 })]} />);
    expect(screen.queryByRole("button", { name: "Actions for Opening balance" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Undone").length).toBeGreaterThan(0);
  });
});

describe("TransactionForm for business owners", () => {
  it("records a project expense under its business", async () => {
    const fetchFn = routeFetch({
      "GET /businesses": () => ({ body: [{ id: 4, name: "Sri Interiors", category: "construction", is_archived: false, project_count: 1 }] }),
      "GET /businesses/4/projects": () => ({ body: [{ id: 11, business_id: 4, name: "Villa 12", status: "active" }] }),
      "POST /transactions": () => ({ status: 201, body: { id: 3, kind: "expense", amount: "4000.00" } }),
    });
    wrap(<TransactionForm onDone={vi.fn()} defaultBusinessId={4} defaultProjectId={11} />);
    expect(await screen.findByLabelText("For")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Amount/), "4000");
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ business_id: 4, project_id: 11, kind: "expense" });
  });

  it("hides business fields for people without a business and never sends them for transfers", async () => {
    routeFetch({ "GET /businesses": () => ({ body: [] }) });
    wrap(<TransactionForm onDone={vi.fn()} />);
    await waitFor(() => expect(screen.queryByLabelText("For")).not.toBeInTheDocument());
  });

  it("does not offer balance-adjustment types when editing an ordinary transaction", async () => {
    routeFetch({});
    wrap(<TransactionForm onDone={vi.fn()} initial={txn({ kind: "refund", kind_label: "Refund" })} />);
    expect(screen.getByRole("tab", { name: "Refund" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Adjustment (+)" })).not.toBeInTheDocument();
  });
});

describe("QuickBar", () => {
  it("records a saved shortcut with one click, once, with an idempotency key", async () => {
    let release: () => void = () => {};
    const fetchFn = routeFetch({
      "GET /quick-transactions": () => ({ body: [{ id: 2, name: "Buy curd", kind: "expense", amount: "35.00", account: { id: 1, name: "SBI" }, category: null, business: null, project: null, description: "", merchant: "", payment_method: "", sort_order: 1, use_count: 0, last_used_at: null }] }),
    });
    // Hold the run request open so a second click lands while the first is still in flight.
    const original = fetchFn.getMockImplementation()!;
    fetchFn.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/quick-transactions/2/run")) {
        await new Promise<void>((r) => (release = r));
        return new Response(JSON.stringify({ id: 50, amount: "35.00" }), { status: 201 });
      }
      return original(url, init);
    });
    wrap(<QuickBar />);
    const chip = await screen.findByRole("button", { name: /Record Buy curd/ });
    await userEvent.click(chip);
    await userEvent.click(chip); // double tap while the first request is running
    release();
    await waitFor(() => expect(chip).not.toBeDisabled());
    const runs = fetchFn.mock.calls.filter(([u]) => String(u).endsWith("/run"));
    expect(runs).toHaveLength(1);
    expect((runs[0][1]!.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
  });

  it("invites setting up shortcuts when there are none", async () => {
    routeFetch({ "GET /quick-transactions": () => ({ body: [] }) });
    wrap(<QuickBar />);
    expect(await screen.findByText(/like a packet of curd/)).toBeInTheDocument();
  });
});

describe("CompareChart", () => {
  it("shows an empty state instead of a blank chart", () => {
    render(<CompareChart rows={[{ key: "2026-10", label: "Oct", a: "0", b: "0" }]} aLabel="Income" bLabel="Costs" netLabel="Profit" emptyLabel="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("totals both series and the difference", () => {
    render(
      <CompareChart
        rows={[
          { key: "2026-09", label: "Sep", a: "1000.00", b: "400.00" },
          { key: "2026-10", label: "Oct", a: "500.00", b: "700.00" },
        ]}
        aLabel="Income"
        bLabel="Costs"
        netLabel="Profit"
      />,
    );
    expect(screen.getByText("₹1,500.00")).toBeInTheDocument();
    expect(screen.getByText("₹1,100.00")).toBeInTheDocument();
    expect(screen.getByText("₹400.00")).toBeInTheDocument();
  });
});
