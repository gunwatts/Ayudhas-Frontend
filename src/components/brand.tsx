import { Handshake } from "lucide-react";

import { cn } from "@/lib/utils";

/** The product name, used in page titles, the sidebar and the sign-in pages. */
export const APP_NAME = "Finance Ayudhas";

/** The Ayudhas logo mark: a fixed square, so it never stretches or clips at any size. */
export function BrandMark({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-primary text-primary-foreground",
        size === "lg" ? "size-10 rounded-xl" : "size-7 rounded-lg",
        className,
      )}
    >
      <Handshake className={size === "lg" ? "size-5" : "size-4"} />
    </span>
  );
}

/** Logo mark + name, for the sidebar. */
export function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
      <BrandMark />
      <span className="truncate">{APP_NAME}</span>
    </span>
  );
}
