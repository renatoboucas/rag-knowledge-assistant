import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { billingService } from "@/lib/billing";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.created":
    case "customer.updated":
      await billingService.syncCustomer(event.data.object as Stripe.Customer);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await billingService.syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription);
        await billingService.syncSubscription(subscription);
      }
      break;
    }
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.updated":
      await billingService.syncInvoice(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
}

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { message: "Stripe webhook secret is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ message: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  try {
    const event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid Stripe webhook." },
      { status: 400 },
    );
  }
}
