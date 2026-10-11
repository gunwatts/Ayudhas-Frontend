"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/common";
import { useSession } from "@/lib/session";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, error, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login/${next}`);
    }
  }, [status, pathname, router]);

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md p-6 pt-24">
        <ErrorState error={error} onRetry={() => refresh()} />
      </div>
    );
  }
  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
