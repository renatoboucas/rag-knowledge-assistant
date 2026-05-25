CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" JSONB NOT NULL DEFAULT '[]',
  "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
  "last_used_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_request_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "api_key_id" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "latency_ms" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_organization_id_revoked_at_idx" ON "api_keys"("organization_id", "revoked_at");
CREATE INDEX "api_keys_organization_id_prefix_idx" ON "api_keys"("organization_id", "prefix");
CREATE INDEX "api_request_logs_organization_id_created_at_idx" ON "api_request_logs"("organization_id", "created_at");
CREATE INDEX "api_request_logs_api_key_id_created_at_idx" ON "api_request_logs"("api_key_id", "created_at");
CREATE INDEX "api_request_logs_organization_id_path_created_at_idx" ON "api_request_logs"("organization_id", "path", "created_at");

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "api_request_logs"
  ADD CONSTRAINT "api_request_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_request_logs"
  ADD CONSTRAINT "api_request_logs_api_key_id_fkey"
  FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
