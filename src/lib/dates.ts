import { endOfMonth, endOfQuarter, endOfYear, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths } from "date-fns";

/** API dates are plain calendar dates (YYYY-MM-DD) in the app's time zone; never shift them through UTC. */
export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function today() {
  return isoDate(new Date());
}

export function formatDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  return format(parseISO(value), pattern);
}

export function formatMonth(value: string) {
  return format(parseISO(value.length === 7 ? `${value}-01` : value), "MMM yyyy");
}

export type RangePreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "last_12_months" | "all" | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  this_year: "This year",
  last_12_months: "Last 12 months",
  all: "All time",
  custom: "Custom",
};

export function presetRange(preset: RangePreset, now = new Date()): { start: string; end: string } | null {
  switch (preset) {
    case "this_month":
      return { start: isoDate(startOfMonth(now)), end: isoDate(endOfMonth(now)) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { start: isoDate(startOfMonth(prev)), end: isoDate(endOfMonth(prev)) };
    }
    case "this_quarter":
      return { start: isoDate(startOfQuarter(now)), end: isoDate(endOfQuarter(now)) };
    case "this_year":
      return { start: isoDate(startOfYear(now)), end: isoDate(endOfYear(now)) };
    case "last_12_months":
      return { start: isoDate(startOfMonth(subMonths(now, 11))), end: isoDate(endOfMonth(now)) };
    case "all":
      return { start: "2000-01-01", end: isoDate(endOfYear(now)) };
    default:
      return null;
  }
}
