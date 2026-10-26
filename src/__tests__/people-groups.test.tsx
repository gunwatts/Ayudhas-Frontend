import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PeoplePage from "@/app/(app)/people/page";

const zero = { lent_outstanding: "0.00", borrowed_outstanding: "0.00", held_for: "0.00" };
const people = [
  { id: 1, name: "Brother", relationship: "family", phone: "", email: "", notes: "", ...zero, spent_for: "3300.00", received_from: "0.00", for_them_balance: "-3300.00", group_ids: [5] },
  { id: 2, name: "Dad", relationship: "family", phone: "", email: "", notes: "", ...zero, spent_for: "0.00", received_from: "2000.00", for_them_balance: "2000.00", group_ids: [5] },
];
const groups = [
  { id: 5, name: "Family", notes: "", members: [{ id: 1, name: "Brother" }, { id: 2, name: "Dad" }], spent_for: "3300.00", received_from: "2000.00", for_them_balance: "-1300.00", ...zero },
];

describe("People page", () => {
  it("shows what was spent for each person and a group's combined balance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname.replace("/api/v1", "");
        const body = path === "/people" ? people : path === "/people/groups" ? groups : [];
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PeoplePage />
      </QueryClientProvider>,
    );
    const family = (await screen.findByText("Family")).closest("tr")!;
    expect(within(family).getByText("Brother, Dad")).toBeInTheDocument();
    expect(within(family).getByText(/1,300/)).toBeInTheDocument();
    const brother = screen.getAllByText("Brother").map((n) => n.closest("tr")!).find((r) => within(r).queryAllByText(/3,300/).length > 0)!;
    expect(within(brother).getAllByText(/3,300/).length).toBe(2); // spent for them, and the balance
  });
});
