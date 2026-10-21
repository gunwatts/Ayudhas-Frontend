import { describe, expect, it } from "vitest";

import { emiPreview } from "@/components/loans";

const homeLoan = { principal: "600000", interest_rate: "11.95", tenure_months: "36", frequency: "monthly" as const };

describe("emiPreview", () => {
  it("matches the bank / SEBI calculator EMI for a reducing-balance loan", () => {
    expect(emiPreview({ ...homeLoan, interest_method: "reducing_balance" })?.toFixed(2)).toBe("19914.26");
  });

  it("charges interest on the full principal for a flat-rate loan", () => {
    // (6,00,000 + 6,00,000 × 11.95% × 3) / 36
    expect(emiPreview({ ...homeLoan, interest_method: "flat" })?.toFixed(2)).toBe("22641.67");
    expect(emiPreview({ ...homeLoan, interest_method: "flat" }, "reducing_balance")?.toFixed(2)).toBe("19914.26");
  });

  it("has no EMI without a tenure or for bullet loans", () => {
    expect(emiPreview({ ...homeLoan, tenure_months: "", interest_method: "reducing_balance" })).toBeNull();
    expect(emiPreview({ ...homeLoan, interest_method: "simple_bullet" })).toBeNull();
  });
});
