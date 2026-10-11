import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryBreakdown } from "@/components/charts";
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
    expect(items[7]).toHaveTextContent("Other (2)");
    expect(items[7]).toHaveTextContent("₹300.00"); // 200 + 100
    expect(items[0]).toHaveTextContent("20.0%"); // 900 / 4500
  });

  it("shows an empty state instead of a chart when there is no spending", () => {
    render(<CategoryBreakdown data={[]} />);
    expect(screen.getByText("No spending in this period")).toBeInTheDocument();
  });
});
