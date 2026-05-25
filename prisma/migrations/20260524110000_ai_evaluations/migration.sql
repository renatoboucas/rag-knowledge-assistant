CREATE TYPE "EvaluationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "evaluation_datasets" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "evaluation_datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_cases" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "dataset_id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "expected_answer" TEXT,
  "expected_citation_ids" JSONB NOT NULL DEFAULT '[]',
  "required_keywords" JSONB NOT NULL DEFAULT '[]',
  "expected_documents" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "evaluation_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_runs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "dataset_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "EvaluationRunStatus" NOT NULL DEFAULT 'QUEUED',
  "retrieval_mode" TEXT NOT NULL DEFAULT 'hybrid',
  "aggregate_scores" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_results" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "retrieved_citation_ids" JSONB NOT NULL DEFAULT '[]',
  "retrieved_document_ids" JSONB NOT NULL DEFAULT '[]',
  "context" TEXT,
  "retrieval_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hallucination_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "response_quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overall_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "risk" TEXT NOT NULL DEFAULT 'medium',
  "issues" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluation_datasets_organization_id_name_key" ON "evaluation_datasets"("organization_id", "name");
CREATE INDEX "evaluation_datasets_organization_id_deleted_at_idx" ON "evaluation_datasets"("organization_id", "deleted_at");
CREATE INDEX "evaluation_cases_organization_id_dataset_id_deleted_at_idx" ON "evaluation_cases"("organization_id", "dataset_id", "deleted_at");
CREATE INDEX "evaluation_runs_organization_id_dataset_id_created_at_idx" ON "evaluation_runs"("organization_id", "dataset_id", "created_at");
CREATE INDEX "evaluation_runs_organization_id_status_idx" ON "evaluation_runs"("organization_id", "status");
CREATE UNIQUE INDEX "evaluation_results_run_id_case_id_key" ON "evaluation_results"("run_id", "case_id");
CREATE INDEX "evaluation_results_organization_id_run_id_idx" ON "evaluation_results"("organization_id", "run_id");
CREATE INDEX "evaluation_results_organization_id_overall_score_idx" ON "evaluation_results"("organization_id", "overall_score");

ALTER TABLE "evaluation_datasets"
  ADD CONSTRAINT "evaluation_datasets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_cases"
  ADD CONSTRAINT "evaluation_cases_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_cases"
  ADD CONSTRAINT "evaluation_cases_dataset_id_fkey"
  FOREIGN KEY ("dataset_id") REFERENCES "evaluation_datasets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_runs"
  ADD CONSTRAINT "evaluation_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_runs"
  ADD CONSTRAINT "evaluation_runs_dataset_id_fkey"
  FOREIGN KEY ("dataset_id") REFERENCES "evaluation_datasets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_results"
  ADD CONSTRAINT "evaluation_results_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_results"
  ADD CONSTRAINT "evaluation_results_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_results"
  ADD CONSTRAINT "evaluation_results_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "evaluation_cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
