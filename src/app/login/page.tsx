"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { APP_NAME, BrandMark } from "@/components/brand";
import { Field } from "@/components/fields";
import { GoogleButton, OrDivider, useAuthConfig } from "@/components/google-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/session";

const schema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

/** Only allow in-app relative paths after sign-in (prevents open redirects). */
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

function LoginForm() {
  const { status, login, adopt } = useSession();
  const config = useAuthConfig().data;
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.username, values.password);
      router.replace(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign-in failed. Please try again.");
      form.setValue("password", "");
      form.setFocus("password");
    }
  });

  const onGoogle = async (credential: string) => {
    setError(null);
    try {
      adopt(await api.post<Schemas["SessionOut"]>("/auth/google", { credential }));
      router.replace(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.");
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <BrandMark size="lg" className="mx-auto mb-2" />
        <p className="text-sm font-semibold tracking-tight text-muted-foreground">{APP_NAME}</p>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Use your username and password, or continue with Google.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Username" error={form.formState.errors.username?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="username" autoFocus aria-describedby={describedBy} aria-invalid={invalid} {...form.register("username")} />
            )}
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="password" autoComplete="current-password" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("password")} />
            )}
          </Field>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
        {config?.google_client_id && (
          <div className="mt-4 grid gap-4">
            <OrDivider />
            <GoogleButton clientId={config.google_client_id} onCredential={onGoogle} />
          </div>
        )}
        {config?.registration_open && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup/" className="font-medium text-foreground underline underline-offset-4">
              Create an account
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div className="grid w-full max-w-sm justify-items-center gap-4">
        <Suspense fallback={<Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />}>
          <LoginForm />
        </Suspense>
        <a href="https://ayudhas.com" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          {APP_NAME} · part of Ayudhas
        </a>
      </div>
    </main>
  );
}
