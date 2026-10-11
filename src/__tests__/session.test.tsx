import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionProvider, useSession } from "@/lib/session";

const SESSION = { user: { id: 1, username: "asha" }, csrf_token: "tok", currency: "INR", time_zone: "Asia/Kolkata" };

function Probe() {
  const { status, logout } = useSession();
  return (
    <>
      <span data-testid="status">{status}</span>
      <button onClick={() => logout().catch(() => {})}>out</button>
    </>
  );
}

function renderSession(logoutResponse: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/auth/logout") ? logoutResponse() : new Response(JSON.stringify(SESSION), { status: 200 }),
    ),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe("session logout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("becomes anonymous after signing out", async () => {
    renderSession(() => new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    await act(async () => screen.getByText("out").click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("anonymous"));
  });

  it("becomes anonymous even when the server call fails", async () => {
    renderSession(() => new Response(JSON.stringify({ error: { code: "x", message: "boom" } }), { status: 500 }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    await act(async () => screen.getByText("out").click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("anonymous"));
  });
});
