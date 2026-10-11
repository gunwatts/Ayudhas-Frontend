import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, onUnauthorized, setCsrfToken } from "@/lib/api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("API client", () => {
  beforeEach(() => setCsrfToken("tok-123"));

  it("sends credentials, CSRF header and idempotency key on writes", async () => {
    const fn = mockFetch(201, { id: 1 });
    await api.post("/transactions", { amount: "1.00" }, "key-1");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/v1/transactions");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("tok-123");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("never sends the CSRF token on reads and encodes array query params", async () => {
    const fn = mockFetch(200, { items: [] });
    await api.get("/transactions", { kind: ["expense", "refund"], q: "", page: 2 });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("kind=expense&kind=refund");
    expect(url).toContain("page=2");
    expect(url).not.toContain("q=");
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  });

  it("maps the uniform error body to ApiError with field details", async () => {
    mockFetch(422, { error: { code: "invalid", message: "Amount must be greater than zero", details: [{ field: "amount", message: "x" }] } });
    const err = (await api.post("/transactions", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.details[0].field).toBe("amount");
  });

  it("notifies listeners on 401 (expired session)", async () => {
    mockFetch(401, { error: { code: "unauthenticated", message: "Please sign in" } });
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    await api.get("/dashboard").catch(() => {});
    expect(listener).toHaveBeenCalledOnce();
    off();
  });

  it("reports network failures with a friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = (await api.get("/dashboard").catch((e) => e)) as ApiError;
    expect(err.code).toBe("network");
    expect(err.message).toMatch(/Can't reach the server/);
  });
});
