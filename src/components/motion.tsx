"use client";

import { useEffect, useRef, useState } from "react";

import { formatMoney, isNegative, toNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";
const canAnimate = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia(REDUCED).matches;

/**
 * Money that counts up to its value (and glides between values when it changes). The animation is display
 * only: it always settles on the exact decimal string from the API, formatted like <Money>.
 */
export function AnimatedMoney({
  value,
  className,
  compact,
  sign,
  tone = "neutral",
  duration = 900,
  ...rest
}: {
  value: string | number | null | undefined;
  className?: string;
  compact?: boolean;
  sign?: boolean;
  tone?: "neutral" | "auto" | "in" | "out";
  duration?: number;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children">) {
  const present = value !== null && value !== undefined && value !== "";
  const target = toNumber(value);
  const shown = useRef(0);
  const [display, setDisplay] = useState<number | null>(() => (present && canAnimate() ? 0 : null));

  useEffect(() => {
    if (!present) return;
    const from = shown.current;
    let raf = 0;
    if (!canAnimate() || from === target) {
      raf = requestAnimationFrame(() => {
        shown.current = target;
        setDisplay(null);
      });
      return () => cancelAnimationFrame(raf);
    }
    // Use one clock for start and progress (rAF timestamps can come from a different origin), and clamp.
    const t0 = performance.now();
    const step = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - t0) / duration));
      const v = from + (target - from) * (1 - Math.pow(1 - k, 3));
      shown.current = v;
      if (k < 1) {
        setDisplay(v);
        raf = requestAnimationFrame(step);
      } else {
        shown.current = target;
        setDisplay(null);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [present, target, duration]);

  const negative = typeof value === "string" ? isNegative(value) : typeof value === "number" && value < 0;
  const color = tone === "in" ? "text-positive" : tone === "auto" && negative ? "text-negative" : "";
  return (
    <span className={cn("num whitespace-nowrap", color, className)} {...rest}>
      {display === null ? formatMoney(value, { compact, sign }) : formatMoney(display, { compact, sign })}
    </span>
  );
}

/** Circular progress (e.g. share of salary spent). Fills from empty on mount. */
export function RingProgress({
  value,
  size = 132,
  stroke = 12,
  color = "var(--spend)",
  track = "var(--muted)",
  label,
  children,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          key={pct}
          className="animate-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          style={{ ["--ring-circ" as string]: `${circ}` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

const GLYPHS: { glyph: string; coin?: boolean; left: string; top: string; size: number; dur: number; delay: number }[] = [
  { glyph: "₹", left: "6%", top: "14%", size: 72, dur: 19, delay: 0 },
  { glyph: "₹", coin: true, left: "82%", top: "9%", size: 64, dur: 23, delay: -6 },
  { glyph: "₹", left: "44%", top: "62%", size: 120, dur: 27, delay: -11 },
  { glyph: "₹", coin: true, left: "16%", top: "76%", size: 52, dur: 21, delay: -3 },
  { glyph: "₹", left: "90%", top: "58%", size: 84, dur: 25, delay: -14 },
  { glyph: "₹", coin: true, left: "58%", top: "18%", size: 40, dur: 17, delay: -8 },
  { glyph: "%", left: "30%", top: "34%", size: 44, dur: 22, delay: -5 },
  { glyph: "₹", coin: true, left: "70%", top: "86%", size: 46, dur: 20, delay: -9 },
];

/** Fixed, decorative background: soft emerald / blue / gold light with slowly drifting rupee glyphs and coins. */
export function MoneyAmbient() {
  return (
    <div className="money-ambient" aria-hidden>
      {GLYPHS.map((g, i) => (
        <span
          key={i}
          className={cn("money-glyph", g.coin && "coin")}
          style={{
            left: g.left,
            top: g.top,
            fontSize: g.coin ? g.size * 0.5 : g.size,
            width: g.coin ? g.size : undefined,
            height: g.coin ? g.size : undefined,
            ["--dur" as string]: `${g.dur}s`,
            ["--delay" as string]: `${g.delay}s`,
          }}
        >
          {g.glyph}
        </span>
      ))}
    </div>
  );
}
