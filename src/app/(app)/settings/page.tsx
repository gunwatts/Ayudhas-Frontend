"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/common";
import { Field } from "@/components/fields";
import { FormError } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, applyFieldErrors, API_BASE_URL, setCsrfToken, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/session";
import { type ThemeChoice, useTheme } from "@/lib/theme";

function PasswordCard() {
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useSession();
  const form = useForm({ defaultValues: { current_password: "", new_password: "", confirm: "" } });
  const e = form.formState.errors;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Signs out your other sessions. Use at least 10 characters.</CardDescription>
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
              toast.success("Password changed");
            } catch (err) {
              setError(applyFieldErrors(err, form.setError as never, ["current_password", "new_password"]));
            }
          })}
        >
          <Field label="Current password" error={e.current_password?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="current-password" aria-invalid={invalid} {...form.register("current_password")} />}</Field>
          <Field label="New password" error={e.new_password?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} {...form.register("new_password")} />}</Field>
          <Field label="Confirm new password" error={e.confirm?.message}>{({ id, invalid }) => <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} {...form.register("confirm")} />}</Field>
          <FormError message={error} />
          <div><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Change password"}</Button></div>
        </form>
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
        <PasswordCard />
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
