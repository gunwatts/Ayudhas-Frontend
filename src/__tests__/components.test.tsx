import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryBreakdown, SalaryExpensesChart } from "@/components/charts";
import { AnimatedMoney } from "@/components/motion";
import { TransactionForm } from "@/components/transaction-form";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function routeFetch(handlers: Record<string, (init?: RequestInit) => unknown>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace("/api/v1", "");
    const key = `${init?.method ?? "GET"} ${path}`;
    const handler = handlers[key];
    if (!handler) return new Response(JSON.stringify([]), { status: 200 });
    const out = handler(init) as { status?: number; body: unknown };
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("TransactionForm", () => {
  it("shows inline validation and does not call the API for invalid input", async () => {
    const fetchFn = routeFetch({});
    wrap(<TransactionForm onDone={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "10.555");
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await screen.findByText(/at most 2 decimals/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Amount/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("requires both accounts for a transfer", async () => {
    routeFetch({});
    wrap(<TransactionForm onDone={vi.fn()} defaultKind="transfer" />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add transfer" }));
    expect(await screen.findByText("Choose the source account")).toBeInTheDocument();
    expect(screen.getByText("Choose the destination account")).toBeInTheDocument();
  });

  it("submits a normalized body with an idempotency key and reports success", async () => {
    const onDone = vi.fn();
    const fetchFn = routeFetch({
      "POST /transactions": () => ({ status: 201, body: { id: 7, kind: "expense", amount: "1250.50" } }),
    });
    wrap(<TransactionForm onDone={onDone} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "1,250.5");
    await userEvent.type(screen.getByLabelText("Description"), "  Groceries  ");
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")!;
    const body = JSON.parse(post[1]!.body as string);
    expect(body).toMatchObject({ kind: "expense", amount: "1250.5", description: "Groceries", account_id: null });
    expect((post[1]!.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
  });

  it("sends the event by name so an existing event is reused or a new one created", async () => {
    const fetchFn = routeFetch({
      "GET /budgets": () => ({ body: [{ id: 3, name: "Sister's wedding", scope: "event" }] }),
      "POST /transactions": () => ({ status: 201, body: { id: 8, kind: "expense", amount: "500.00" } }),
    });
    wrap(<TransactionForm onDone={vi.fn()} defaultEventName="Sister's wedding" />);
    expect(screen.getByLabelText("Event")).toHaveValue("Sister's wedding");
    await userEvent.type(screen.getByLabelText(/^Amount/), "500");
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ event_name: "Sister's wedding" });
  });

  it("does not link income to an event", async () => {
    const fetchFn = routeFetch({ "POST /transactions": () => ({ status: 201, body: { id: 9, kind: "income", amount: "100.00" } }) });
    wrap(<TransactionForm onDone={vi.fn()} defaultKind="income" defaultEventName="Trip" />);
    expect(screen.queryByLabelText("Event")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Amount/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add income" }));
    await waitFor(() => expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string).event_name).toBe("");
  });

  it("maps server field errors onto the form", async () => {
    routeFetch({
      "POST /transactions": () => ({ status: 422, body: { error: { code: "invalid", message: "Insufficient balance", details: [{ field: "amount", message: "Insufficient balance in 'Bank'" }] } } }),
    });
    wrap(<TransactionForm onDone={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "999");
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await screen.findByText("Insufficient balance in 'Bank'")).toBeInTheDocument();
  });
});

describe("CategoryBreakdown", () => {
  it("folds categories beyond seven into Other and lists every value with its share", () => {
    const data = Array.from({ length: 9 }, (_, i) => ({ category_id: i + 1, name: `Cat ${i + 1}`, color: "", total: `${(9 - i) * 100}.00` }));
    render(<CategoryBreakdown data={data} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items[7]).toHaveTextContent("Other (2 categories)");
    expect(items[7]).toHaveTextContent("₹300.00"); // 200 + 100
    expect(items[0]).toHaveTextContent("20.0%"); // 900 / 4500
  });

  it("shows an empty state instead of a chart when there is no spending", () => {
    render(<CategoryBreakdown data={[]} />);
    expect(screen.getByText("No spending in this period")).toBeInTheDocument();
  });

  it("switches to a ranked bar view with full category names", async () => {
    const long = "Children's school fees and uniforms";
    const data = [
      { category_id: 1, name: "Rent", color: "", total: "15000.00" },
      { category_id: 2, name: long, color: "", total: "20000.00" },
    ];
    render(<CategoryBreakdown data={data} />);
    await userEvent.click(screen.getByRole("button", { name: /Ranking/ }));
    const ranked = within(screen.getByRole("list", { name: /largest first/ })).getAllByRole("listitem");
    expect(ranked[0]).toHaveTextContent(long);
    expect(ranked[0]).toHaveTextContent("57.1%");
    expect(screen.getByRole("button", { name: /Ranking/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("SalaryExpensesChart", () => {
  const point = (month: string, salary: string, expenses: string, source: "income" | "set" | "none" = "set") => ({
    month,
    salary,
    expenses,
    remaining: (Number(salary) - Number(expenses)).toFixed(2),
    salary_source: source,
    income: "0.00",
    net: "0.00",
    other_income: "0.00",
  });

  it("summarises the latest month with data and steps between months", async () => {
    render(<SalaryExpensesChart data={[point("2026-08", "45250.00", "41159.00"), point("2026-09", "45250.00", "50000.00"), point("2026-10", "0.00", "0.00", "none")]} />);
    expect(await screen.findByText("Sep 2026")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("-₹4,750.00")).toBeInTheDocument());
    expect(screen.getByText(/110% of salary spent/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("No salary recorded for this month")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("Aug 2026")).toBeInTheDocument();
  });

  it("lets series be hidden but never all of them", async () => {
    render(<SalaryExpensesChart data={[point("2026-10", "100.00", "50.00")]} />);
    const salary = screen.getByRole("button", { name: "Salary" });
    const spent = screen.getByRole("button", { name: "Spent" });
    const remaining = screen.getByRole("button", { name: "Remaining" });
    await userEvent.click(salary);
    await userEvent.click(spent);
    await userEvent.click(remaining);
    expect(salary).toHaveAttribute("aria-pressed", "false");
    expect(spent).toHaveAttribute("aria-pressed", "false");
    expect(remaining).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AnimatedMoney", () => {
  it("always settles on the exact amount", async () => {
    const { rerender } = render(<AnimatedMoney value="45250.50" data-testid="m" />);
    await waitFor(() => expect(screen.getByTestId("m")).toHaveTextContent("₹45,250.50"));
    rerender(<AnimatedMoney value="-1752.25" tone="auto" data-testid="m" />);
    await waitFor(() => expect(screen.getByTestId("m")).toHaveTextContent("-₹1,752.25"));
    expect(screen.getByTestId("m")).toHaveClass("text-negative");
  });
});
