import { describe, expect, it } from "vitest";

import { addMoney, formatMoney, fromPaise, isNegative, isValidAmount, subMoney, toPaise } from "@/lib/money";

describe("money helpers (decimal-safe)", () => {
  it("adds without floating-point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem we avoid
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(addMoney("1999999999.99", "0.01")).toBe("2000000000.00");
    expect(subMoney("100.00", "100.01")).toBe("-0.01");
  });

  it("round-trips paise", () => {
    expect(toPaise("1,234.5")).toBe(BigInt(123450));
    expect(fromPaise(BigInt(-5))).toBe("-0.05");
    expect(isNegative("-0.00")).toBe(false);
    expect(isNegative("-1.00")).toBe(true);
  });

  it("validates user-entered amounts", () => {
    for (const ok of ["1", "0.01", "1,00,000.50", " 42.10 "]) expect(isValidAmount(ok)).toBe(true);
    for (const bad of ["0", "0.00", "-5", "1.005", "abc", "", "1e5"]) expect(isValidAmount(bad)).toBe(false);
  });

  it("formats INR with Indian digit grouping", () => {
    expect(formatMoney("148115.12")).toBe("₹1,48,115.12");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney("1250000", { compact: true })).toMatch(/₹12\.5L|₹1\.3M|₹12\.5 lakh/);
  });
});
