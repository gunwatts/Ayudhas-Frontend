"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BackupTransferCard } from "@/components/backup-transfer";
import { PageHeader } from "@/components/common";
import { Field } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { GoogleButton, useAuthConfig } from "@/components/google-button";
import { ProfileOptions, useSetProfile } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError, applyFieldErrors, API_BASE_URL, setCsrfToken, type Schemas } from "@/lib/api";
import type { FinancialProfile } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { type ThemeChoice, useTheme } from "@/lib/theme";

function PasswordCard() {
  const [error, setError] = useState<string | null>(null);
  const { refresh, session, user } = useSession();
  const hasPassword = session?.has_password ?? true;
  const form = useForm({ defaultValues: { current_password: "", new_password: "", confirm: "" } });
  const e = form.formState.errors;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{hasPassword ? "Change password" : "Set a password"}</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Signs out your other sessions. Use at least 10 characters."
            : `You sign in with Google. Add a password to also sign in with your username, ${user?.username}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            if (v.new_password.length < 10) return form.setError("new_password", { message: "Use at least 10 characters" });
            if (v.new_password !== v.confirm) return form.setError("confirm", { message: "Passwords don't match" });
            setError(null);
            try {
              const s = await api.post<Schemas["SessionOut"]>("/auth/password", { current_password: v.current_password, new_password: v.new_password });
              setCsrfToken(s.csrf_token);
              await refresh();
              form.reset();
              toast.success(hasPassword ? "Password changed" : "Password set");
            } catch (err) {
              setError(applyFieldErrors(err, form.setError as never, ["current_password", "new_password"]));
            }
          })}
        >
          {hasPassword && <Field label="Current password" error={e.current_password?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="current-password" aria-invalid={invalid} {...form.register("current_password")} />}</Field>}
          <Field label="New password" error={e.new_password?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} {...form.register("new_password")} />}</Field>
          <Field label="Confirm new password" error={e.confirm?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} {...form.register("confirm")} />}</Field>
          <FormError message={error} />
          <div><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : hasPassword ? "Change password" : "Set password"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { session } = useSession();
  const { save, saving } = useSetProfile();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How you earn</CardTitle>
        <CardDescription>Shapes your overview and the cards you see. Changing it never changes or hides your records.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileOptions
          value={(session?.financial_profile as FinancialProfile | null | undefined) ?? null}
          saving={saving}
          onChoose={async (v) => {
            if (await save(v)) toast.success("Saved. Your overview now matches.");
          }}
        />
      </CardContent>
    </Card>
  );
}

function GoogleCard() {
  const clientId = useAuthConfig().data?.google_client_id;
  const { session, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  if (!clientId || !session) return null;
  const fail = (err: unknown) => toast.error(err instanceof ApiError ? err.message : "Something went wrong");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in with Google</CardTitle>
        <CardDescription>
          {session.google_connected
            ? "Your Google account is connected. You can sign in with it instead of your password."
            : "Connect your Google account to sign in with one click."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-md gap-3">
        {session.google_connected ? (
          <>
            <div>
              <Button
                variant="outline"
                disabled={busy || !session.has_password}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.delete("/auth/google/connect");
                    await refresh();
                    toast.success("Google disconnected");
                  } catch (err) {
                    fail(err);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Disconnect Google
              </Button>
            </div>
            {!session.has_password && <p className="text-xs text-muted-foreground">Set a password first, so you can still sign in without Google.</p>}
          </>
        ) : (
          <GoogleButton
            clientId={clientId}
            text="continue_with"
            onCredential={async (credential) => {
              try {
                await api.post("/auth/google/connect", { credential });
                await refresh();
                toast.success("Google connected");
              } catch (err) {
                fail(err);
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useSession();
  const { choice, setChoice } = useTheme();
  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user?.username}`} />
      <div className="grid gap-6">
        <ProfileCard />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Saved on this device only.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={choice} onValueChange={(v) => setChoice(v as ThemeChoice)}>
              <TabsList><TabsTrigger value="system">System</TabsTrigger><TabsTrigger value="light">Light</TabsTrigger><TabsTrigger value="dark">Dark</TabsTrigger></TabsList>
            </Tabs>
          </CardContent>
        </Card>
        <div id="password" className="scroll-mt-20">
          <PasswordCard />
        </div>
        <GoogleCard />
        <div id="backup" className="scroll-mt-20">
          <BackupTransferCard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>Amounts are in Indian rupees (₹). Dates use your local calendar.</p>
            <p>Server: <span className="font-mono text-xs">{API_BASE_URL}</span></p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
