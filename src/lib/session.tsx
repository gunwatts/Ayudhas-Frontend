"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { api, ApiError, onUnauthorized, setCsrfToken, type Schemas } from "./api";

type SessionData = Schemas["SessionOut"];
type SessionState = {
  status: "loading" | "authenticated" | "anonymous" | "error";
  user: SessionData["user"] | null;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
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

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.post<SessionData>("/auth/login", { username, password });
      setCsrfToken(data.csrf_token);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      qc.setQueryData(["session"], data);
    },
    [qc],
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
      error: query.error,
      login,
      logout,
      refresh: query.refetch,
    };
  }, [query.isPending, query.isError, query.data, query.error, query.refetch, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
