ALTER TABLE "organizations"
  ADD COLUMN "data_region" TEXT NOT NULL DEFAULT 'us',
  ADD COLUMN "retention_days" INTEGER NOT NULL DEFAULT 365;

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resource_id" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'success',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit_buckets" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "key" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "window_start" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_organization_id_action_created_at_idx"
  ON "audit_logs"("organization_id", "action", "created_at");
CREATE INDEX "audit_logs_organization_id_resource_resource_id_idx"
  ON "audit_logs"("organization_id", "resource", "resource_id");
CREATE INDEX "audit_logs_user_id_created_at_idx"
  ON "audit_logs"("user_id", "created_at");

CREATE UNIQUE INDEX "rate_limit_buckets_key_route_window_start_key"
  ON "rate_limit_buckets"("key", "route", "window_start");
CREATE INDEX "rate_limit_buckets_organization_id_route_expires_at_idx"
  ON "rate_limit_buckets"("organization_id", "route", "expires_at");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
