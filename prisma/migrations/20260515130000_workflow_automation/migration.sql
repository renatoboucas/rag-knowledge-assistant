CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TYPE "WorkflowTriggerType" AS ENUM (
  'MANUAL',
  'SCHEDULE',
  'CONNECTOR_WEBHOOK',
  'DOCUMENT_CREATED'
);

CREATE TYPE "WorkflowRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "workflows" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "trigger_type" "WorkflowTriggerType" NOT NULL,
  "trigger_config" JSONB NOT NULL DEFAULT '{}',
  "actions" JSONB NOT NULL DEFAULT '[]',
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "last_run_status" "WorkflowRunStatus",
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_runs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "workflow_id" TEXT NOT NULL,
  "status" "WorkflowRunStatus" NOT NULL DEFAULT 'QUEUED',
  "trigger_type" "WorkflowTriggerType" NOT NULL,
  "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB NOT NULL DEFAULT '{}',
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_run_steps" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "status" "WorkflowRunStatus" NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB NOT NULL DEFAULT '{}',
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_run_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflows_organization_id_status_trigger_type_deleted_at_idx"
  ON "workflows"("organization_id", "status", "trigger_type", "deleted_at");
CREATE INDEX "workflows_organization_id_next_run_at_idx"
  ON "workflows"("organization_id", "next_run_at");
CREATE INDEX "workflow_runs_organization_id_workflow_id_status_idx"
  ON "workflow_runs"("organization_id", "workflow_id", "status");
CREATE INDEX "workflow_runs_organization_id_status_created_at_idx"
  ON "workflow_runs"("organization_id", "status", "created_at");
CREATE INDEX "workflow_run_steps_workflow_run_id_status_idx"
  ON "workflow_run_steps"("workflow_run_id", "status");

ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_run_steps"
  ADD CONSTRAINT "workflow_run_steps_workflow_run_id_fkey"
  FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
