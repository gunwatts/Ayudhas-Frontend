import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlanForm } from "@/components/planning";

function setup(scope: "event" | "monthly") {
  const posts: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname.replace("/api/v1", "");
      if (init?.method === "POST" && path === "/budgets") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }
      if (path === "/accounts") return new Response(JSON.stringify([{ id: 7, name: "SBI", type: "bank", balance: "0.00", is_archived: false }]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    }),
  );
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlanForm scope={scope} onDone={onDone} />
    </QueryClientProvider>,
  );
  return { posts, onDone };
}

describe("PlanForm", () => {
  it("links an event to a month", async () => {
    const { posts, onDone } = setup("event");
    await userEvent.type(screen.getByLabelText(/Event name/), "Goa trip");
    await userEvent.type(screen.getByLabelText("Count all its expenses in"), "2026-10");
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts[0]).toMatchObject({ scope: "event", name: "Goa trip", counts_in_month: "2026-10-01" });
  });

  it("sends no account when the salary isn't recorded as income", async () => {
    const { posts, onDone } = setup("monthly");
    await userEvent.type(screen.getByLabelText(/Salary for the month/), "45250");
    expect(screen.getByLabelText("Credited to")).toBeInTheDocument();
    expect(screen.queryByLabelText("Credited on")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save salary" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts[0]).toMatchObject({ scope: "monthly", amount: "45250" });
    expect(posts[0]).not.toHaveProperty("credit_account_id");
  });
});
