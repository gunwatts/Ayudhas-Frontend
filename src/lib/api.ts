/**
 * API client. Session cookie is HttpOnly (never readable here); the CSRF token returned by
 * /auth/login and /auth/me is kept in memory only and sent as X-CSRF-Token on writes.
 */
import type { components } from "./api-types";

export type Schemas = components["schemas"];

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

let csrfToken = "";
export function setCsrfToken(token: string) {
  csrfToken = token;
}

export type FieldError = { field: string | null; message: string };

export class ApiError extends Error {
  status: number;
  code: string;
  details: FieldError[];
  constructor(status: number, code: string, message: string, details: FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(fn: () => void) {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
}

export async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: { body?: unknown; query?: Query; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: FieldError[] } })?.error;
    const apiError = new ApiError(
      response.status,
      err?.code ?? "error",
      err?.message ?? `Request failed (${response.status})`,
      err?.details ?? [],
    );
    if (response.status === 401 && !path.startsWith("/auth/login")) unauthorizedListeners.forEach((fn) => fn());
    throw apiError;
  }
  if (payload === null) throw new ApiError(response.status, "bad_response", "Unexpected response from the server");
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>("POST", path, { body: body ?? {}, idempotencyKey }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  delete: (path: string) => request<void>("DELETE", path),
};

export function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Map server field errors onto react-hook-form fields; returns the message for non-field errors. */
export function applyFieldErrors(
  error: unknown,
  setError: (name: never, value: { type: string; message: string }) => void,
  knownFields: readonly string[],
): string | null {
  if (!(error instanceof ApiError)) return "Something went wrong";
  let unmatched: string | null = null;
  for (const d of error.details) {
    const field = d.field;
    if (field && knownFields.includes(field)) setError(field as never, { type: "server", message: d.message });
    else unmatched ??= d.message;
  }
  if (!error.details.length) return error.message;
  return unmatched;
}
