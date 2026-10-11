"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { api, ApiError, onUnauthorized, setCsrfToken, type Schemas } from "./api";

type SessionData = Schemas["SessionOut"];
type SessionState = {
  status: "loading" | "authenticated" | "anonymous" | "error";
  user: SessionData["user"] | null;
  /** Full session (has_password, google_connected, …) when signed in. */
  session: SessionData | null;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  /** Adopt a session returned by sign-up, Google sign-in or account changes. */
  adopt: (data: SessionData) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
};

const SessionContext = createContext<SessionState | null>(null);

async function fetchSession(): Promise<SessionData | null> {
  try {
    const data = await api.get<SessionData>("/auth/me");
    setCsrfToken(data.csrf_token);
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCsrfToken("");
      return null;
    }
    throw error;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["session"], queryFn: fetchSession, retry: 1, staleTime: 5 * 60_000 });

  useEffect(
    () =>
      onUnauthorized(() => {
        setCsrfToken("");
        qc.setQueryData(["session"], null);
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      }),
    [qc],
  );

  const adopt = useCallback(
    (data: SessionData) => {
      setCsrfToken(data.csrf_token);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" && q.queryKey[0] !== "auth-config" });
      qc.setQueryData(["session"], data);
    },
    [qc],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      adopt(await api.post<SessionData>("/auth/login", { username, password }));
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      // Keep the session query itself (clearing it would detach the mounted observer, leaving the UI
      // "authenticated"); mark it signed out and drop every cached financial query.
      setCsrfToken("");
      qc.setQueryData(["session"], null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    }
  }, [qc]);

  const value = useMemo<SessionState>(() => {
    const status = query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : query.data
          ? "authenticated"
          : "anonymous";
    return {
      status,
      user: query.data?.user ?? null,
      session: query.data ?? null,
      error: query.error,
      login,
      adopt,
      logout,
      refresh: query.refetch,
    };
  }, [query.isPending, query.isError, query.data, query.error, query.refetch, login, adopt, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
