"use client";

import { Briefcase, Check, Laptop, Loader2, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { APP_NAME, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type Schemas } from "@/lib/api";
import type { FinancialProfile } from "@/lib/queries";
import { useInvalidateFinance } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const PROFILES: { value: FinancialProfile; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: "salaried",
    label: "Salaried",
    description: "A monthly salary. See salary vs spending, what's left each month, and your other income.",
    icon: Briefcase,
  },
  {
    value: "freelancer",
    label: "Freelancer",
    description: "Earnings that vary. See what you earned vs what you spent, with no salary needed.",
    icon: Laptop,
  },
  {
    value: "business",
    label: "Business owner",
    description: "Run a business. Track business and project income, operating costs and profit, apart from personal money.",
    icon: Store,
  },
];

/** Saves the profile and refreshes the session and dashboard. */
export function useSetProfile() {
  const { adopt } = useSession();
  const invalidate = useInvalidateFinance();
  const [saving, setSaving] = useState<FinancialProfile | null>(null);
  const save = async (value: FinancialProfile) => {
    setSaving(value);
    try {
      adopt(await api.put<Schemas["SessionOut"]>("/auth/profile", { financial_profile: value }));
      await invalidate();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Please try again.");
      return false;
    } finally {
      setSaving(null);
    }
  };
  return { save, saving };
}

export function ProfileOptions({ value, onChoose, saving }: { value: FinancialProfile | null; onChoose: (v: FinancialProfile) => void; saving: FinancialProfile | null }) {
  return (
    <div role="radiogroup" aria-label="How you earn" className="grid gap-3 sm:grid-cols-3">
      {PROFILES.map((p) => {
        const selected = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!!saving}
            onClick={() => onChoose(p.value)}
            className={cn(
              "relative grid content-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-70",
              selected && "border-primary bg-primary/10",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                <p.icon className="size-4" aria-hidden />
              </span>
              {saving === p.value ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : selected && <Check className="size-4 text-primary" aria-hidden />}
            </span>
            <span className="font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/** First sign-in: ask how the user earns. Shown until they choose; it can be changed later in Settings. */
export function OnboardingDialog() {
  const { session } = useSession();
  const { save, saving } = useSetProfile();
  const open = !!session && session.financial_profile == null;
  return (
    <Dialog open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="text-sm font-semibold text-muted-foreground">{APP_NAME}</span>
          </div>
          <DialogTitle>Welcome! How do you earn?</DialogTitle>
          <DialogDescription>We&apos;ll set up your overview to match. You can change this any time in Settings, and nothing you record is lost.</DialogDescription>
        </DialogHeader>
        <ProfileOptions value={null} saving={saving} onChoose={(v) => void save(v)} />
        <p className="text-xs text-muted-foreground">Accounts, expenses, loans, money held for others and reports work the same for everyone.</p>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={!!saving} onClick={() => void save("salaried")}>
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
