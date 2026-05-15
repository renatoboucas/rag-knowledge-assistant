ALTER TYPE "DocumentSourceType" ADD VALUE IF NOT EXISTS 'CONFLUENCE';
ALTER TYPE "DocumentSourceType" ADD VALUE IF NOT EXISTS 'GITHUB';

CREATE TYPE "ConnectorProvider" AS ENUM (
  'GOOGLE_DRIVE',
  'NOTION',
  'CONFLUENCE',
  'SLACK',
  'GITHUB'
);

CREATE TYPE "ConnectorStatus" AS ENUM (
  'DISCONNECTED',
  'CONNECTED',
  'SYNCING',
  'ERROR',
  'PAUSED'
);

CREATE TYPE "ConnectorSyncStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "connectors" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "provider" "ConnectorProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ConnectorStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "config" JSONB NOT NULL DEFAULT '{}',
  "credentials" JSONB NOT NULL DEFAULT '{}',
  "sync_cursor" TEXT,
  "last_sync_started_at" TIMESTAMP(3),
  "last_sync_finished_at" TIMESTAMP(3),
  "last_webhook_at" TIMESTAMP(3),
  "error_message" TEXT,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sync_interval_min" INTEGER NOT NULL DEFAULT 60,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connector_sync_jobs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "connector_id" TEXT NOT NULL,
  "status" "ConnectorSyncStatus" NOT NULL DEFAULT 'QUEUED',
  "sync_type" TEXT NOT NULL DEFAULT 'manual',
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "cursor_before" TEXT,
  "cursor_after" TEXT,
  "documents_seen" INTEGER NOT NULL DEFAULT 0,
  "documents_added" INTEGER NOT NULL DEFAULT 0,
  "documents_updated" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connector_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connectors_organization_id_provider_name_key"
  ON "connectors"("organization_id", "provider", "name");
CREATE INDEX "connectors_organization_id_provider_status_deleted_at_idx"
  ON "connectors"("organization_id", "provider", "status", "deleted_at");
CREATE INDEX "connectors_organization_id_is_enabled_sync_interval_min_idx"
  ON "connectors"("organization_id", "is_enabled", "sync_interval_min");
CREATE INDEX "connector_sync_jobs_organization_id_connector_id_status_idx"
  ON "connector_sync_jobs"("organization_id", "connector_id", "status");
CREATE INDEX "connector_sync_jobs_organization_id_status_created_at_idx"
  ON "connector_sync_jobs"("organization_id", "status", "created_at");

ALTER TABLE "connectors"
  ADD CONSTRAINT "connectors_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connectors"
  ADD CONSTRAINT "connectors_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "connector_sync_jobs"
  ADD CONSTRAINT "connector_sync_jobs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connector_sync_jobs"
  ADD CONSTRAINT "connector_sync_jobs_connector_id_fkey"
  FOREIGN KEY ("connector_id") REFERENCES "connectors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
