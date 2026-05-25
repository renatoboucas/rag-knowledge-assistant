import Stripe from "stripe";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { billingPlans, fromPrismaBillingPlan, getBillingPlan, toPrismaBillingPlan } from "./plans";
import type { BillingPlanKey } from "./plans";
import { getStripe, isStripeConfigured } from "./stripe";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function fromUnix(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

function subscriptionStatus(status: Stripe.Subscription.Status) {
  return status.toUpperCase() as
    | "INCOMPLETE"
    | "INCOMPLETE_EXPIRED"
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "UNPAID"
    | "PAUSED";
}

function planFromPriceId(priceId?: string | null): BillingPlanKey {
  if (priceId && priceId === env.STRIPE_ENTERPRISE_PRICE_ID) {
    return "enterprise";
  }

  if (priceId && priceId === env.STRIPE_PRO_PRICE_ID) {
    return "pro";
  }

  return "free";
}

function firstSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0];
}

export class BillingService {
  async getOrCreateCustomer(input: {
    organizationId: string;
    organizationName: string;
    email?: string | null;
  }) {
    const existing = await prisma.billingCustomer.findUnique({
      where: { organizationId: input.organizationId },
    });

    if (existing) {
      return existing;
    }

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: input.email ?? undefined,
      name: input.organizationName,
      metadata: {
        organizationId: input.organizationId,
      },
    });

    return prisma.billingCustomer.create({
      data: {
        organizationId: input.organizationId,
        stripeCustomerId: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: jsonValue(customer.metadata),
      },
    });
  }

  async createCheckoutSession(input: {
    organizationId: string;
    userEmail: string;
    plan: Exclude<BillingPlanKey, "free">;
    origin: string;
  }) {
    const plan = getBillingPlan(input.plan);

    if (!plan.stripePriceId) {
      throw new Error(`${plan.name} is not configured with a Stripe price id.`);
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    });
    const customer = await this.getOrCreateCustomer({
      organizationId: input.organizationId,
      organizationName: organization.name,
      email: input.userEmail,
    });

    const stripe = getStripe();
    return stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: input.organizationId,
      success_url: `${input.origin}/dashboard/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/dashboard/settings?billing=cancelled`,
      subscription_data: {
        metadata: {
          organizationId: input.organizationId,
          plan: input.plan,
        },
      },
      metadata: {
        organizationId: input.organizationId,
        plan: input.plan,
      },
    });
  }

  async createPortalSession(input: { organizationId: string; origin: string }) {
    const customer = await prisma.billingCustomer.findUnique({
      where: { organizationId: input.organizationId },
    });

    if (!customer) {
      throw new Error("No Stripe customer exists for this workspace.");
    }

    const stripe = getStripe();
    return stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${input.origin}${env.BILLING_PORTAL_RETURN_PATH}`,
    });
  }

  async getOverview(organizationId: string) {
    const [customer, subscription, usage, invoices] = await Promise.all([
      prisma.billingCustomer.findUnique({ where: { organizationId } }),
      prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.usageEvent.groupBy({
        by: ["metric"],
        where: {
          organizationId,
          occurredAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { quantity: true, amount: true },
      }),
      prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const planKey = fromPrismaBillingPlan(subscription?.plan);
    const plan = getBillingPlan(planKey);
    const tokenUsage = usage.find((entry) => entry.metric === "AI_TOKENS");
    const tokensUsed = tokenUsage?._sum.quantity ?? 0;
    const billableTokens = Math.max(0, tokensUsed - plan.includedTokens);

    return {
      configured: isStripeConfigured(),
      customer,
      plan,
      plans: Object.values(billingPlans),
      subscription,
      usage: {
        period: "current_month",
        tokensUsed,
        includedTokens: plan.includedTokens,
        billableTokens,
        estimatedTokenOverageCents: (billableTokens / 1000) * plan.tokenOverageCentsPerThousand,
        byMetric: usage.map((entry) => ({
          metric: entry.metric,
          quantity: entry._sum.quantity ?? 0,
          amount: entry._sum.amount ?? 0,
        })),
      },
      invoices,
    };
  }

  async syncCustomer(customer: Stripe.Customer) {
    const organizationId = customer.metadata.organizationId;

    if (!organizationId) {
      return null;
    }

    return prisma.billingCustomer.upsert({
      where: { organizationId },
      update: {
        stripeCustomerId: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: jsonValue(customer.metadata),
      },
      create: {
        organizationId,
        stripeCustomerId: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: jsonValue(customer.metadata),
      },
    });
  }

  async syncSubscription(subscription: Stripe.Subscription) {
    const organizationId = subscription.metadata.organizationId;
    const item = firstSubscriptionItem(subscription);
    const priceId = item?.price.id;
    const productId =
      typeof item?.price.product === "string" ? item.price.product : item?.price.product.id;
    const subscriptionWithPeriod = subscription as Stripe.Subscription & {
      current_period_start?: number;
      current_period_end?: number;
    };

    if (!organizationId) {
      return null;
    }

    return prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      update: {
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        stripePriceId: priceId,
        stripeProductId: productId,
        plan: toPrismaBillingPlan(planFromPriceId(priceId)),
        status: subscriptionStatus(subscription.status),
        quantity: item?.quantity ?? 1,
        currentPeriodStart: fromUnix(subscriptionWithPeriod.current_period_start),
        currentPeriodEnd: fromUnix(subscriptionWithPeriod.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: fromUnix(subscription.canceled_at),
        trialEndsAt: fromUnix(subscription.trial_end),
        metadata: jsonValue(subscription.metadata),
      },
      create: {
        organizationId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        stripePriceId: priceId,
        stripeProductId: productId,
        plan: toPrismaBillingPlan(planFromPriceId(priceId)),
        status: subscriptionStatus(subscription.status),
        quantity: item?.quantity ?? 1,
        currentPeriodStart: fromUnix(subscriptionWithPeriod.current_period_start),
        currentPeriodEnd: fromUnix(subscriptionWithPeriod.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: fromUnix(subscription.canceled_at),
        trialEndsAt: fromUnix(subscription.trial_end),
        metadata: jsonValue(subscription.metadata),
      },
    });
  }

  async syncInvoice(invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    if (!customerId) {
      return null;
    }

    const customer = await prisma.billingCustomer.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!customer) {
      return null;
    }

    const invoiceWithPeriod = invoice as Stripe.Invoice & {
      period_start?: number;
      period_end?: number;
    };

    return prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      update: {
        stripeCustomerId: customerId,
        status: invoice.status ?? "unknown",
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        total: invoice.total,
        amountPaid: invoice.amount_paid,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        periodStart: fromUnix(invoiceWithPeriod.period_start),
        periodEnd: fromUnix(invoiceWithPeriod.period_end),
        metadata: jsonValue(invoice.metadata),
      },
      create: {
        organizationId: customer.organizationId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        status: invoice.status ?? "unknown",
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        total: invoice.total,
        amountPaid: invoice.amount_paid,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        periodStart: fromUnix(invoiceWithPeriod.period_start),
        periodEnd: fromUnix(invoiceWithPeriod.period_end),
        metadata: jsonValue(invoice.metadata),
      },
    });
  }
}

export const billingService = new BillingService();
