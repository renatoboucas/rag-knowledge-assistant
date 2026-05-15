CREATE TABLE "observability_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "user_id" TEXT,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "trace_id" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "observability_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "observability_events_organization_id_category_created_at_idx"
  ON "observability_events"("organization_id", "category", "created_at");
CREATE INDEX "observability_events_organization_id_name_created_at_idx"
  ON "observability_events"("organization_id", "name", "created_at");
CREATE INDEX "observability_events_trace_id_idx"
  ON "observability_events"("trace_id");

ALTER TABLE "observability_events"
  ADD CONSTRAINT "observability_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "observability_events"
  ADD CONSTRAINT "observability_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
