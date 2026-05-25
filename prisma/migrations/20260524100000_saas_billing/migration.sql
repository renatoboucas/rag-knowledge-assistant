CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PAUSED'
);
CREATE TYPE "BillingUsageMetric" AS ENUM ('AI_TOKENS', 'STORAGE_GB', 'SEATS');

CREATE TABLE "billing_customers" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "stripe_subscription_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT NOT NULL,
  "stripe_price_id" TEXT,
  "stripe_product_id" TEXT,
  "plan" "BillingPlan" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMP(3),
  "trial_ends_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "metric" "BillingUsageMetric" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stripe_meter_event_id" TEXT,
  "stripe_customer_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'internal',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "stripe_invoice_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "subtotal" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "amount_paid" INTEGER NOT NULL DEFAULT 0,
  "hosted_invoice_url" TEXT,
  "invoice_pdf" TEXT,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_customers_organization_id_key" ON "billing_customers"("organization_id");
CREATE UNIQUE INDEX "billing_customers_stripe_customer_id_key" ON "billing_customers"("stripe_customer_id");
CREATE INDEX "billing_customers_organization_id_idx" ON "billing_customers"("organization_id");

CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "subscriptions_organization_id_status_idx" ON "subscriptions"("organization_id", "status");
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

CREATE UNIQUE INDEX "usage_events_stripe_meter_event_id_key" ON "usage_events"("stripe_meter_event_id");
CREATE UNIQUE INDEX "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");
CREATE INDEX "usage_events_organization_id_metric_occurred_at_idx" ON "usage_events"("organization_id", "metric", "occurred_at");
CREATE INDEX "usage_events_subscription_id_occurred_at_idx" ON "usage_events"("subscription_id", "occurred_at");

CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key" ON "invoices"("stripe_invoice_id");
CREATE INDEX "invoices_organization_id_created_at_idx" ON "invoices"("organization_id", "created_at");
CREATE INDEX "invoices_stripe_customer_id_idx" ON "invoices"("stripe_customer_id");

ALTER TABLE "billing_customers"
  ADD CONSTRAINT "billing_customers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
