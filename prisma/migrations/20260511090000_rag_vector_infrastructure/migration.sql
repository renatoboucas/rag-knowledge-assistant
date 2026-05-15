CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED', 'ARCHIVED');
CREATE TYPE "DocumentSourceType" AS ENUM ('UPLOAD', 'URL', 'NOTION', 'GOOGLE_DRIVE', 'SLACK', 'API');
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "MessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "title" TEXT NOT NULL,
  "source_type" "DocumentSourceType" NOT NULL DEFAULT 'UPLOAD',
  "source_uri" TEXT,
  "mime_type" TEXT,
  "checksum" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "start_char" INTEGER,
  "end_char" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "embeddings" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "chunk_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "vector" vector(1536) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
  "template" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retrieval_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "document_id" TEXT,
  "chunk_id" TEXT,
  "embedding_id" TEXT,
  "query" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "similarity" DOUBLE PRECISION,
  "rank" INTEGER,
  "latency_ms" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "retrieval_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documents_organization_id_status_deleted_at_idx" ON "documents"("organization_id", "status", "deleted_at");
CREATE INDEX "documents_organization_id_source_type_idx" ON "documents"("organization_id", "source_type");
CREATE INDEX "documents_organization_id_checksum_idx" ON "documents"("organization_id", "checksum");

CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");
CREATE INDEX "document_chunks_organization_id_document_id_deleted_at_idx" ON "document_chunks"("organization_id", "document_id", "deleted_at");
CREATE INDEX "document_chunks_organization_id_content_hash_idx" ON "document_chunks"("organization_id", "content_hash");

CREATE UNIQUE INDEX "embeddings_chunk_id_provider_model_key" ON "embeddings"("chunk_id", "provider", "model");
CREATE INDEX "embeddings_organization_id_provider_model_deleted_at_idx" ON "embeddings"("organization_id", "provider", "model", "deleted_at");
CREATE INDEX "embeddings_vector_hnsw_idx" ON "embeddings" USING hnsw ("vector" vector_cosine_ops);

CREATE INDEX "conversations_organization_id_status_deleted_at_idx" ON "conversations"("organization_id", "status", "deleted_at");

CREATE INDEX "messages_organization_id_conversation_id_created_at_idx" ON "messages"("organization_id", "conversation_id", "created_at");
CREATE INDEX "messages_organization_id_role_idx" ON "messages"("organization_id", "role");

CREATE UNIQUE INDEX "prompts_organization_id_key_version_key" ON "prompts"("organization_id", "key", "version");
CREATE INDEX "prompts_organization_id_status_deleted_at_idx" ON "prompts"("organization_id", "status", "deleted_at");

CREATE INDEX "retrieval_logs_organization_id_conversation_id_created_at_idx" ON "retrieval_logs"("organization_id", "conversation_id", "created_at");
CREATE INDEX "retrieval_logs_organization_id_document_id_idx" ON "retrieval_logs"("organization_id", "document_id");
CREATE INDEX "retrieval_logs_organization_id_chunk_id_idx" ON "retrieval_logs"("organization_id", "chunk_id");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "embeddings"
  ADD CONSTRAINT "embeddings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "embeddings"
  ADD CONSTRAINT "embeddings_chunk_id_fkey"
  FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prompts"
  ADD CONSTRAINT "prompts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prompts"
  ADD CONSTRAINT "prompts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retrieval_logs"
  ADD CONSTRAINT "retrieval_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retrieval_logs"
  ADD CONSTRAINT "retrieval_logs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retrieval_logs"
  ADD CONSTRAINT "retrieval_logs_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retrieval_logs"
  ADD CONSTRAINT "retrieval_logs_chunk_id_fkey"
  FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retrieval_logs"
  ADD CONSTRAINT "retrieval_logs_embedding_id_fkey"
  FOREIGN KEY ("embedding_id") REFERENCES "embeddings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
