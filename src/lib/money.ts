/**
 * Money arrives from the API as decimal strings ("1234.50"). Display formatting uses Intl; any
 * client-side arithmetic (previews only — the backend is authoritative) uses integer paise via BigInt.
 */
export const CURRENCY = "INR";

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(opts: { compact?: boolean; decimals?: number; sign?: boolean }) {
  const key = JSON.stringify(opts);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: CURRENCY,
      notation: opts.compact ? "compact" : "standard",
      minimumFractionDigits: opts.compact ? 0 : (opts.decimals ?? 2),
      maximumFractionDigits: opts.compact ? 1 : (opts.decimals ?? 2),
      signDisplay: opts.sign ? "exceptZero" : "auto",
    });
    formatters.set(key, f);
  }
  return f;
}

/** Number used ONLY for display/charting (never for persisted arithmetic). */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return typeof value === "number" ? value : Number(value);
}

export function formatMoney(
  value: string | number | null | undefined,
  opts: { compact?: boolean; decimals?: number; sign?: boolean } = {},
) {
  if (value === null || value === undefined || value === "") return "—";
  return formatter(opts).format(toNumber(value));
}

const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

/** Validate a user-entered amount string: positive, max 2 decimals. */
export function isValidAmount(input: string) {
  const s = input.trim().replace(/,/g, "");
  return AMOUNT_RE.test(s) && toPaise(s) > BigInt(0);
}

export function normalizeAmount(input: string) {
  return input.trim().replace(/,/g, "");
}

export function toPaise(value: string): bigint {
  const s = normalizeAmount(value);
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const paise = BigInt(whole || "0") * BigInt(100) + BigInt((frac + "00").slice(0, 2));
  return negative ? -paise : paise;
}

export function fromPaise(paise: bigint): string {
  const negative = paise < BigInt(0);
  const abs = negative ? -paise : paise;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function addMoney(...values: (string | null | undefined)[]): string {
  return fromPaise(values.reduce((acc, v) => acc + (v ? toPaise(v) : BigInt(0)), BigInt(0)));
}

export function subMoney(a: string, b: string): string {
  return fromPaise(toPaise(a) - toPaise(b));
}

export function isNegative(value: string | null | undefined) {
  return !!value && value.trim().startsWith("-") && toPaise(value) !== BigInt(0);
}

export function isZero(value: string | null | undefined) {
  return !value || toPaise(value) === BigInt(0);
}
