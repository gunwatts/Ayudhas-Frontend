"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "ft-theme";

function readChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Inline script that runs before paint so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{var c=localStorage.getItem('${KEY}');}catch(e){c=null}var d=c==='dark'||(c!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';})();`;

const ThemeContext = createContext<{ choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Static prerender has no window; client pages read the saved choice on first render.
  const [choice, setChoiceState] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "system" : readChoice()));

  useEffect(() => {
    apply(choice);
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      if (c === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, c);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
  }, []);

  return <ThemeContext.Provider value={{ choice, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
