import crypto from "node:crypto";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Prisma, WorkflowTriggerType } from "@prisma/client";

import { LlmOrchestrator } from "@/lib/ai/llm-orchestrator";
import { connectorSyncQueue } from "@/lib/connectors/jobs/connector-sync-queue";
import { connectorService } from "@/lib/connectors/services/connector-service";
import { prisma } from "@/lib/prisma";
import { embeddingQueue } from "@/lib/embeddings/queue/embedding-queue";
import { modelMessageContent } from "@/lib/ai/message-content";
import type {
  WorkflowAction,
  WorkflowRunInput,
  WorkflowTriggerConfig,
} from "@/lib/workflows/types";

type CreateWorkflowInput = {
  organizationId: string;
  userId: string;
  name: string;
  description?: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig: WorkflowTriggerConfig;
  actions: WorkflowAction[];
  status?: "DRAFT" | "ACTIVE" | "PAUSED";
};

function nextRunAt(triggerType: WorkflowTriggerType, config: WorkflowTriggerConfig) {
  if (triggerType !== "SCHEDULE" || !config.intervalMinutes) {
    return null;
  }

  return new Date(Date.now() + config.intervalMinutes * 60 * 1000);
}

function jsonArray(value: Prisma.JsonValue): WorkflowAction[] {
  return Array.isArray(value) ? (value as WorkflowAction[]) : [];
}

export class WorkflowService {
  async list(organizationId: string) {
    return prisma.workflow.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { steps: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
  }

  async create(input: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.userId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
        status: input.status ?? "DRAFT",
        nextRunAt: nextRunAt(input.triggerType, input.triggerConfig),
      },
    });
  }

  async update(
    organizationId: string,
    workflowId: string,
    input: Partial<Omit<CreateWorkflowInput, "organizationId" | "userId">>,
  ) {
    return prisma.workflow.update({
      where: { id: workflowId, organizationId },
      data: {
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig as Prisma.InputJsonValue | undefined,
        actions: input.actions as Prisma.InputJsonValue | undefined,
        status: input.status,
        nextRunAt:
          input.triggerType && input.triggerConfig
            ? nextRunAt(input.triggerType, input.triggerConfig)
            : undefined,
      },
    });
  }

  async archive(organizationId: string, workflowId: string) {
    return prisma.workflow.update({
      where: { id: workflowId, organizationId },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
  }

  async createRun(organizationId: string, workflowId: string, input: WorkflowRunInput) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });

    if (!workflow) {
      throw new Error("Workflow not found.");
    }

    return prisma.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        triggerType: input.triggerType,
        input: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async enqueueDueScheduledWorkflows(organizationId: string) {
    const workflows = await prisma.workflow.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        triggerType: "SCHEDULE",
        deletedAt: null,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
    });

    const runs = [];

    for (const workflow of workflows) {
      const run = await this.createRun(organizationId, workflow.id, {
        triggerType: "SCHEDULE",
        payload: { scheduledAt: new Date().toISOString() },
      });
      runs.push(run);
    }

    return runs;
  }

  async triggerMatching(organizationId: string, triggerType: WorkflowTriggerType, payload = {}) {
    const workflows = await prisma.workflow.findMany({
      where: { organizationId, triggerType, status: "ACTIVE", deletedAt: null },
    });

    const runs = [];

    for (const workflow of workflows) {
      const config = workflow.triggerConfig as WorkflowTriggerConfig;

      if (
        triggerType === "CONNECTOR_WEBHOOK" &&
        config.connectorId &&
        config.connectorId !== (payload as { connectorId?: string }).connectorId
      ) {
        continue;
      }

      runs.push(
        await this.createRun(organizationId, workflow.id, {
          triggerType,
          payload,
        }),
      );
    }

    return runs;
  }

  async runWorkflow(runId: string) {
    const run = await prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { workflow: true },
    });
    const actions = jsonArray(run.workflow.actions);
    const outputs: Record<string, unknown>[] = [];

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      for (const action of actions) {
        const step = await prisma.workflowRunStep.create({
          data: {
            workflowRunId: run.id,
            actionType: action.type,
            input: (action.config ?? {}) as Prisma.InputJsonValue,
            status: "RUNNING",
            startedAt: new Date(),
          },
        });

        try {
          const output = await this.executeAction(run.organizationId, action);
          outputs.push({ actionType: action.type, ...output });

          await prisma.workflowRunStep.update({
            where: { id: step.id },
            data: {
              status: "COMPLETED",
              output: output as Prisma.InputJsonValue,
              finishedAt: new Date(),
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Workflow step failed.";
          await prisma.workflowRunStep.update({
            where: { id: step.id },
            data: { status: "FAILED", errorMessage: message, finishedAt: new Date() },
          });
          throw error;
        }
      }

      const triggerConfig = run.workflow.triggerConfig as WorkflowTriggerConfig;
      await prisma.$transaction([
        prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            output: { actions: outputs } as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        }),
        prisma.workflow.update({
          where: { id: run.workflowId },
          data: {
            lastRunAt: new Date(),
            lastRunStatus: "COMPLETED",
            nextRunAt: nextRunAt(run.workflow.triggerType, triggerConfig),
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow failed.";
      await prisma.$transaction([
        prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: "FAILED", errorMessage: message, finishedAt: new Date() },
        }),
        prisma.workflow.update({
          where: { id: run.workflowId },
          data: { lastRunAt: new Date(), lastRunStatus: "FAILED" },
        }),
      ]);
      throw error;
    }
  }

  private async executeAction(organizationId: string, action: WorkflowAction) {
    if (action.type === "SYNC_CONNECTOR") {
      const connectorId = String(action.config?.connectorId ?? "");
      const job = await connectorService.createSyncJob(organizationId, connectorId, "workflow");
      connectorSyncQueue.enqueue({ jobId: job.id, connectorId: job.connectorId, organizationId });
      return { connectorId, jobId: job.id };
    }

    if (action.type === "SYNC_ALL_CONNECTORS") {
      const queued = await connectorService.enqueueDueSyncs(organizationId);
      return { queued };
    }

    if (action.type === "INGEST_PENDING_DOCUMENTS") {
      const limit = Number(action.config?.limit ?? 25);
      const documents = await prisma.document.findMany({
        where: { organizationId, status: "PENDING", deletedAt: null },
        orderBy: { updatedAt: "asc" },
        take: Number.isFinite(limit) ? limit : 25,
      });

      for (const document of documents) {
        embeddingQueue.enqueue({ organizationId, documentId: document.id });
      }

      return { queuedDocuments: documents.length };
    }

    if (action.type === "GENERATE_DOCUMENT_SUMMARIES") {
      return this.generateDocumentSummaries(organizationId, action);
    }

    throw new Error(`Unsupported workflow action: ${action.type}`);
  }

  private async generateDocumentSummaries(organizationId: string, action: WorkflowAction) {
    const limit = Number(action.config?.limit ?? 5);
    const documents = await prisma.document.findMany({
      where: { organizationId, deletedAt: null, status: { in: ["PENDING", "INDEXED"] } },
      include: { chunks: { where: { deletedAt: null }, orderBy: { chunkIndex: "asc" }, take: 4 } },
      orderBy: { updatedAt: "desc" },
      take: Number.isFinite(limit) ? limit : 5,
    });
    const orchestrator = new LlmOrchestrator();
    let summarized = 0;

    for (const document of documents) {
      const source = document.chunks
        .map((chunk) => chunk.content)
        .join("\n\n")
        .slice(0, 6000);

      if (!source.trim()) {
        continue;
      }

      let summary = source.split(/\s+/).slice(0, 80).join(" ");

      try {
        const response = await orchestrator.invoke({
          task: "summarization",
          messages: [
            new SystemMessage(
              "Summarize the document for enterprise knowledge retrieval in 5 bullets.",
            ),
            new HumanMessage(source),
          ],
          temperature: 0.1,
          maxOutputTokens: 300,
        });
        summary = modelMessageContent(response.content).trim() || summary;
      } catch {
        summary = `${summary}${summary.length ? "..." : ""}`;
      }

      const metadata =
        document.metadata &&
        typeof document.metadata === "object" &&
        !Array.isArray(document.metadata)
          ? (document.metadata as Record<string, unknown>)
          : {};

      await prisma.document.update({
        where: { id: document.id, organizationId },
        data: {
          metadata: {
            ...metadata,
            aiSummary: summary,
            aiSummaryUpdatedAt: new Date().toISOString(),
            aiSummaryWorkflowId: action.id ?? crypto.randomUUID(),
          },
        },
      });
      summarized += 1;
    }

    return { summarized };
  }
}

export const workflowService = new WorkflowService();
