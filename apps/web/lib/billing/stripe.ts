import Stripe from "stripe";

import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required for billing operations.");
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: {
      name: "RAG Knowledge Assistant",
      version: "0.1.0",
    },
  });

  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}
