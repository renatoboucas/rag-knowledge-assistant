import { env } from "@/lib/env";

export type BillingPlanKey = "free" | "pro" | "enterprise";

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedTokens: number;
  tokenOverageCentsPerThousand: number;
  maxSeats: number | null;
  stripePriceId?: string;
  features: string[];
};

export const billingPlans: Record<BillingPlanKey, BillingPlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    description: "Starter workspace for evaluation and lightweight knowledge search.",
    monthlyPriceCents: 0,
    includedTokens: 50_000,
    tokenOverageCentsPerThousand: 0,
    maxSeats: 2,
    features: ["Single workspace", "Basic RAG chat", "Community support"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    description: "Production team workspace with metered AI usage.",
    monthlyPriceCents: 4_900,
    includedTokens: 1_000_000,
    tokenOverageCentsPerThousand: 1,
    maxSeats: 25,
    stripePriceId: env.STRIPE_PRO_PRICE_ID,
    features: ["Team workspaces", "Advanced retrieval", "Usage analytics", "Priority support"],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    description: "Custom deployment for governed, high-volume AI knowledge operations.",
    monthlyPriceCents: 0,
    includedTokens: 10_000_000,
    tokenOverageCentsPerThousand: 0,
    maxSeats: null,
    stripePriceId: env.STRIPE_ENTERPRISE_PRICE_ID,
    features: ["Custom contract", "SAML and governance", "Dedicated support", "Custom limits"],
  },
};

export function getBillingPlan(plan: BillingPlanKey) {
  return billingPlans[plan];
}

export function toPrismaBillingPlan(plan: BillingPlanKey) {
  return plan.toUpperCase() as "FREE" | "PRO" | "ENTERPRISE";
}

export function fromPrismaBillingPlan(plan?: string | null): BillingPlanKey {
  if (plan === "PRO") {
    return "pro";
  }

  if (plan === "ENTERPRISE") {
    return "enterprise";
  }

  return "free";
}
