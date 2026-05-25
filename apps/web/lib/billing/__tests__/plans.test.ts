import { describe, expect, it } from "vitest";

import {
  billingPlans,
  fromPrismaBillingPlan,
  getBillingPlan,
  toPrismaBillingPlan,
} from "@/lib/billing/plans";

describe("billingPlans", () => {
  it("defines Free, Pro, and Enterprise plans with token allowances", () => {
    expect(Object.keys(billingPlans)).toEqual(["free", "pro", "enterprise"]);
    expect(billingPlans.free.includedTokens).toBeLessThan(billingPlans.pro.includedTokens);
    expect(billingPlans.enterprise.includedTokens).toBeGreaterThan(billingPlans.pro.includedTokens);
  });

  it("maps plan ids to database enum values", () => {
    expect(toPrismaBillingPlan("free")).toBe("FREE");
    expect(toPrismaBillingPlan("pro")).toBe("PRO");
    expect(toPrismaBillingPlan("enterprise")).toBe("ENTERPRISE");
    expect(getBillingPlan("pro").name).toBe("Pro");
    expect(fromPrismaBillingPlan("PRO")).toBe("pro");
    expect(fromPrismaBillingPlan("ENTERPRISE")).toBe("enterprise");
    expect(fromPrismaBillingPlan(null)).toBe("free");
  });
});
