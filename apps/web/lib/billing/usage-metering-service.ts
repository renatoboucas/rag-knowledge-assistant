import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getBillingPlan } from "./plans";
import { getStripe, isStripeConfigured } from "./stripe";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class UsageMeteringService {
  async recordAiTokens(input: {
    organizationId: string;
    quantity: number;
    idempotencyKey: string;
    source?: string;
    occurredAt?: Date;
    metadata?: unknown;
  }) {
    if (input.quantity <= 0) {
      return null;
    }

    const existing = await prisma.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId: input.organizationId,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    const plan = getBillingPlan(
      subscription?.plan === "ENTERPRISE"
        ? "enterprise"
        : subscription?.plan === "PRO"
          ? "pro"
          : "free",
    );
    const unitAmount = plan.tokenOverageCentsPerThousand / 1000;
    const customer = await prisma.billingCustomer.findUnique({
      where: { organizationId: input.organizationId },
    });

    let stripeMeterEventId: string | undefined;

    if (
      isStripeConfigured() &&
      env.STRIPE_AI_TOKEN_METER_EVENT_NAME &&
      customer?.stripeCustomerId &&
      subscription?.plan !== "FREE"
    ) {
      try {
        const meterEvent = await getStripe().billing.meterEvents.create({
          event_name: env.STRIPE_AI_TOKEN_METER_EVENT_NAME,
          identifier: input.idempotencyKey,
          timestamp: Math.floor((input.occurredAt ?? new Date()).getTime() / 1000),
          payload: {
            stripe_customer_id: customer.stripeCustomerId,
            value: String(input.quantity),
          },
        });
        stripeMeterEventId = meterEvent.identifier;
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            organizationId: input.organizationId,
            billingMetric: "AI_TOKENS",
          },
        });
      }
    }

    return prisma.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: subscription?.id,
        metric: "AI_TOKENS",
        quantity: input.quantity,
        unitAmount,
        amount: input.quantity * unitAmount,
        stripeMeterEventId,
        stripeCustomerId: customer?.stripeCustomerId,
        idempotencyKey: input.idempotencyKey,
        source: input.source ?? "internal",
        occurredAt: input.occurredAt,
        metadata: jsonValue(input.metadata),
      },
    });
  }
}

export const usageMetering = new UsageMeteringService();
