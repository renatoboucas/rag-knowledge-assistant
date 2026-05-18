import type { WorkflowTriggerType } from "@prisma/client";

export type WorkflowActionType =
  | "SYNC_CONNECTOR"
  | "SYNC_ALL_CONNECTORS"
  | "INGEST_PENDING_DOCUMENTS"
  | "GENERATE_DOCUMENT_SUMMARIES";

export type WorkflowAction = {
  id?: string;
  type: WorkflowActionType;
  name?: string;
  config?: Record<string, unknown>;
};

export type WorkflowTriggerConfig = {
  intervalMinutes?: number;
  connectorId?: string;
  documentLimit?: number;
};

export type WorkflowRunInput = {
  triggerType: WorkflowTriggerType;
  payload?: Record<string, unknown>;
};

export type WorkflowActionResult = {
  actionType: WorkflowActionType;
  output: Record<string, unknown>;
};
