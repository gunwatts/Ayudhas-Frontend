"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api, type Schemas } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Which sign-in options the server offers (sign-ups open? invite code? Google client id?). */
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api.get<Schemas["AuthConfigOut"]>("/auth/config"),
    staleTime: 10 * 60_000,
  });
}

type GoogleIdApi = {
  initialize: (options: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
};
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleIdApi } } };

let loader: Promise<GoogleIdApi> | null = null;

/** Loads Google Identity Services once, on demand (only pages that show the button pay for it). */
function loadGoogleId(): Promise<GoogleIdApi> {
  const ready = (window as GoogleWindow).google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loader ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const id = (window as GoogleWindow).google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google sign-in did not load"));
    };
    script.onerror = () => {
      loader = null;
      reject(new Error("Google sign-in could not be loaded"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/**
 * Google's own "Sign in with Google" button. Google hands us a signed ID token, which the server verifies.
 * `onCredential` receives that token.
 */
export function GoogleButton({
  clientId,
  text = "signin_with",
  onCredential,
}: {
  clientId: string;
  text?: "signin_with" | "signup_with" | "continue_with";
  onCredential: (credential: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  const { choice } = useTheme();

  useEffect(() => {
    callback.current = onCredential;
  });

  useEffect(() => {
    let cancelled = false;
    loadGoogleId()
      .then((id) => {
        const el = ref.current;
        if (cancelled || !el) return;
        id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential), ux_mode: "popup" });
        el.replaceChildren();
        id.renderButton(el, {
          type: "standard",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "center",
          theme: document.documentElement.classList.contains("dark") ? "filled_black" : "outline",
          width: Math.min(400, Math.max(200, el.clientWidth)),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, text, choice]);

  if (failed) return <p className="text-center text-xs text-muted-foreground">Google sign-in couldn&apos;t load. Check your connection or use your password.</p>;
  // Google draws the button inside an iframe. On a dark page the browser paints an opaque white canvas behind any
  // iframe that doesn't declare a colour scheme, which showed as a white frame around the dark button. Declaring
  // "light" on the host keeps the iframe's canvas transparent, so only Google's own button is visible.
  return (
    <div className="flex w-full justify-center" style={{ colorScheme: "light" }}>
      <div ref={ref} className="flex min-h-10 w-full max-w-[400px] justify-center overflow-hidden rounded-md [&_iframe]:!bg-transparent" data-testid="google-button" />
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
