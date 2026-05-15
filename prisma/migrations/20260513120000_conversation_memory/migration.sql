CREATE TYPE "MemoryType" AS ENUM ('SHORT_TERM', 'LONG_TERM', 'SUMMARY', 'PREFERENCE', 'FACT', 'TASK');
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "conversation_summaries" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "covered_message_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "input_token_count" INTEGER NOT NULL DEFAULT 0,
  "summary_token_count" INTEGER NOT NULL DEFAULT 0,
  "compression_ratio" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memory_items" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "source_message_id" TEXT,
  "type" "MemoryType" NOT NULL DEFAULT 'LONG_TERM',
  "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "content" TEXT NOT NULL,
  "summary" TEXT,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "model" TEXT,
  "dimensions" INTEGER,
  "vector" vector(1536),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "access_count" INTEGER NOT NULL DEFAULT 0,
  "last_accessed_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "memory_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_summaries_organization_id_conversation_id_created_at_idx"
  ON "conversation_summaries"("organization_id", "conversation_id", "created_at");

CREATE INDEX "memory_items_organization_id_type_status_deleted_at_idx"
  ON "memory_items"("organization_id", "type", "status", "deleted_at");
CREATE INDEX "memory_items_organization_id_conversation_id_created_at_idx"
  ON "memory_items"("organization_id", "conversation_id", "created_at");
CREATE INDEX "memory_items_organization_id_importance_idx"
  ON "memory_items"("organization_id", "importance");
CREATE INDEX "memory_items_vector_hnsw_idx"
  ON "memory_items" USING hnsw ("vector" vector_cosine_ops)
  WHERE "vector" IS NOT NULL;

ALTER TABLE "conversation_summaries"
  ADD CONSTRAINT "conversation_summaries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_summaries"
  ADD CONSTRAINT "conversation_summaries_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memory_items"
  ADD CONSTRAINT "memory_items_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memory_items"
  ADD CONSTRAINT "memory_items_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "memory_items"
  ADD CONSTRAINT "memory_items_source_message_id_fkey"
  FOREIGN KEY ("source_message_id") REFERENCES "messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
