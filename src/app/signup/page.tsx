"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Handshake, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Field } from "@/components/fields";
import { GoogleButton, OrDivider, useAuthConfig } from "@/components/google-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError, applyFieldErrors, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/session";

const schema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters")
      .max(150, "Use at most 150 characters")
      .regex(/^[\w.@+-]+$/, "Use letters, numbers and . @ + - _ only"),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it blank")]),
    password: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
    invite_code: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

type Values = z.infer<typeof schema>;
const FIELDS = ["username", "email", "password", "invite_code"] as const;

function Shell({ children, description }: { children: React.ReactNode; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Handshake className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}

const signInLink = (
  <p className="mt-6 text-center text-sm text-muted-foreground">
    Already have an account?{" "}
    <Link href="/login/" className="font-medium text-foreground underline underline-offset-4">
      Sign in
    </Link>
  </p>
);

export default function SignupPage() {
  const { status, adopt } = useSession();
  const router = useRouter();
  const config = useAuthConfig();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", email: "", password: "", confirm: "", invite_code: "" },
  });
  const e = form.formState.errors;

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (config.isPending) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  if (!config.data?.registration_open) {
    return (
      <Shell description={config.isError ? "Couldn't reach the server. Please try again later." : "Sign-ups are closed right now."}>
        {signInLink}
      </Shell>
    );
  }
  const { invite_required: inviteRequired, google_client_id: googleClientId } = config.data;

  const onSubmit = form.handleSubmit(async (v) => {
    if (inviteRequired && !v.invite_code.trim()) return form.setError("invite_code", { message: "Enter your invite code" });
    setError(null);
    try {
      const body = { username: v.username, password: v.password, email: v.email || null, invite_code: v.invite_code };
      adopt(await api.post<Schemas["SessionOut"]>("/auth/register", body));
      router.replace("/");
    } catch (err) {
      setError(applyFieldErrors(err, form.setError as never, FIELDS));
    }
  });

  const onGoogle = async (credential: string) => {
    setError(null);
    try {
      adopt(await api.post<Schemas["SessionOut"]>("/auth/google", { credential }));
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-in failed. Please try again.");
    }
  };

  return (
    <Shell description="Free to use. Your data is private to your account.">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {googleClientId && (
          <>
            <GoogleButton clientId={googleClientId} text="signup_with" onCredential={onGoogle} />
            <OrDivider />
          </>
        )}
        {inviteRequired && (
          <Field label="Invite code" required error={e.invite_code?.message} hint="Needed for password sign-up. Ask the person who shared this site with you.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("invite_code")} />
            )}
          </Field>
        )}
        <Field label="Username" required error={e.username?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} autoComplete="username" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("username")} />
          )}
        </Field>
        <Field label="Email" error={e.email?.message} hint="Optional. Lets you connect Google sign-in later.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("email")} />
          )}
        </Field>
        <Field label="Password" required error={e.password?.message} hint="At least 10 characters.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("password")} />
          )}
        </Field>
        <Field label="Confirm password" required error={e.confirm?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} {...form.register("confirm")} />
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
      {signInLink}
    </Shell>
  );
}
