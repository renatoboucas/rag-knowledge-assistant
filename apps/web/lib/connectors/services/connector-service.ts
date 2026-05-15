import type { ConnectorProvider, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ConnectorAuth, ConnectorConfig } from "@/lib/connectors/types";
import { connectorRegistry } from "@/lib/connectors/providers/registry";
import { embeddingQueue } from "@/lib/embeddings/queue/embedding-queue";
import { secretManager } from "@/lib/security/secret-manager";

type CreateConnectorInput = {
  organizationId: string;
  userId: string;
  provider: ConnectorProvider;
  name: string;
  config?: ConnectorConfig;
  credentials?: ConnectorAuth;
  syncIntervalMin?: number;
};

function credentialsPayload(credentials?: ConnectorAuth) {
  if (!credentials || !Object.keys(credentials).length) {
    return {};
  }

  return secretManager.encryptJson(credentials) as Prisma.InputJsonValue;
}

function readCredentials(payload: Prisma.JsonValue): ConnectorAuth {
  return secretManager.decryptJson<ConnectorAuth>(payload, {});
}

function documentMetadata(input: {
  connectorId: string;
  provider: ConnectorProvider;
  externalId: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    connector: {
      connectorId: input.connectorId,
      provider: input.provider,
      externalId: input.externalId,
      updatedAt: input.updatedAt,
    },
    ...(input.metadata ?? {}),
  } satisfies Prisma.InputJsonValue;
}

export class ConnectorService {
  async list(organizationId: string) {
    const connectors = await prisma.connector.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return connectors.map((connector) => ({
      ...connector,
      credentials: {},
    }));
  }

  async create(input: CreateConnectorInput) {
    const adapter = connectorRegistry.get(input.provider);
    const config = (input.config ?? {}) as Prisma.InputJsonValue;

    await adapter.verify({
      organizationId: input.organizationId,
      config: input.config ?? {},
      auth: input.credentials ?? {},
    });

    return prisma.connector.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.userId,
        provider: input.provider,
        name: input.name,
        config,
        credentials: credentialsPayload(input.credentials),
        status: "CONNECTED",
        syncIntervalMin: input.syncIntervalMin ?? input.config?.syncIntervalMin ?? 60,
      },
    });
  }

  async update(
    organizationId: string,
    connectorId: string,
    input: Partial<{
      name: string;
      config: ConnectorConfig;
      credentials: ConnectorAuth;
      isEnabled: boolean;
      syncIntervalMin: number;
      status: "CONNECTED" | "PAUSED";
    }>,
  ) {
    return prisma.connector.update({
      where: { id: connectorId, organizationId },
      data: {
        name: input.name,
        config: input.config as Prisma.InputJsonValue | undefined,
        credentials: input.credentials ? credentialsPayload(input.credentials) : undefined,
        isEnabled: input.isEnabled,
        syncIntervalMin: input.syncIntervalMin,
        status: input.status,
      },
    });
  }

  async archive(organizationId: string, connectorId: string) {
    return prisma.connector.update({
      where: { id: connectorId, organizationId },
      data: { deletedAt: new Date(), status: "DISCONNECTED", isEnabled: false },
    });
  }

  async enqueueDueSyncs(organizationId: string) {
    const connectors = await prisma.connector.findMany({
      where: {
        organizationId,
        isEnabled: true,
        deletedAt: null,
        status: { in: ["CONNECTED", "ERROR"] },
      },
    });

    const due = connectors.filter((connector) => {
      if (!connector.lastSyncFinishedAt) {
        return true;
      }

      const nextSyncAt =
        connector.lastSyncFinishedAt.getTime() + connector.syncIntervalMin * 60 * 1000;
      return nextSyncAt <= Date.now();
    });

    for (const connector of due) {
      await this.createSyncJob(organizationId, connector.id, "scheduled");
    }

    return due.length;
  }

  async createSyncJob(organizationId: string, connectorId: string, syncType = "manual") {
    const connector = await prisma.connector.findFirst({
      where: { id: connectorId, organizationId, deletedAt: null },
    });

    if (!connector) {
      throw new Error("Connector not found.");
    }

    return prisma.connectorSyncJob.create({
      data: {
        organizationId,
        connectorId,
        syncType,
        cursorBefore: connector.syncCursor,
      },
    });
  }

  async runSyncJob(jobId: string) {
    const job = await prisma.connectorSyncJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { connector: true },
    });
    const adapter = connectorRegistry.get(job.connector.provider);

    await prisma.$transaction([
      prisma.connectorSyncJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date() },
      }),
      prisma.connector.update({
        where: { id: job.connectorId },
        data: { status: "SYNCING", lastSyncStartedAt: new Date(), errorMessage: null },
      }),
    ]);

    try {
      const result = await adapter.sync({
        connectorId: job.connectorId,
        organizationId: job.organizationId,
        cursor: job.cursorBefore,
        config: job.connector.config as ConnectorConfig,
        auth: readCredentials(job.connector.credentials),
      });
      let added = 0;
      let updated = 0;

      for (const item of result.documents) {
        const existing = await prisma.document.findFirst({
          where: {
            organizationId: job.organizationId,
            sourceType: adapter.sourceType,
            sourceUri: item.sourceUri,
            deletedAt: null,
          },
        });

        if (existing && existing.checksum === item.checksum) {
          continue;
        }

        if (existing) {
          await prisma.document.update({
            where: { id: existing.id, organizationId: job.organizationId },
            data: {
              title: item.title,
              checksum: item.checksum,
              mimeType: item.mimeType,
              metadata: documentMetadata({
                connectorId: job.connectorId,
                provider: adapter.provider,
                externalId: item.externalId,
                updatedAt: item.updatedAt,
                metadata: item.metadata,
              }),
              status: "PENDING",
              errorMessage: null,
            },
          });
          await prisma.documentChunk.deleteMany({
            where: { organizationId: job.organizationId, documentId: existing.id },
          });
          await this.createConnectorChunk(job.organizationId, existing.id, item.content);
          embeddingQueue.enqueue({ organizationId: job.organizationId, documentId: existing.id });
          updated += 1;
        } else {
          const document = await prisma.document.create({
            data: {
              organizationId: job.organizationId,
              createdById: job.connector.createdById,
              title: item.title,
              sourceType: adapter.sourceType,
              sourceUri: item.sourceUri ?? `${adapter.provider}:${item.externalId}`,
              mimeType: item.mimeType,
              checksum: item.checksum,
              status: "PENDING",
              metadata: documentMetadata({
                connectorId: job.connectorId,
                provider: adapter.provider,
                externalId: item.externalId,
                updatedAt: item.updatedAt,
                metadata: item.metadata,
              }),
            },
          });
          await this.createConnectorChunk(job.organizationId, document.id, item.content);
          embeddingQueue.enqueue({ organizationId: job.organizationId, documentId: document.id });
          added += 1;
        }
      }

      await prisma.$transaction([
        prisma.connectorSyncJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            finishedAt: new Date(),
            cursorAfter: result.cursor,
            documentsSeen: result.documents.length,
            documentsAdded: added,
            documentsUpdated: updated,
          },
        }),
        prisma.connector.update({
          where: { id: job.connectorId },
          data: {
            status: "CONNECTED",
            syncCursor: result.cursor,
            lastSyncFinishedAt: new Date(),
            errorMessage: null,
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connector sync failed.";
      await prisma.$transaction([
        prisma.connectorSyncJob.update({
          where: { id: job.id },
          data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
        }),
        prisma.connector.update({
          where: { id: job.connectorId },
          data: { status: "ERROR", errorMessage: message, lastSyncFinishedAt: new Date() },
        }),
      ]);
      throw error;
    }
  }

  async recordWebhook(organizationId: string, connectorId: string) {
    const connector = await prisma.connector.update({
      where: { id: connectorId, organizationId },
      data: {
        lastWebhookAt: new Date(),
      },
    });
    return connector;
  }

  private async createConnectorChunk(organizationId: string, documentId: string, content: string) {
    const trimmed = content.slice(0, 150000);
    await prisma.documentChunk.create({
      data: {
        organizationId,
        documentId,
        content: trimmed,
        contentHash: Buffer.from(trimmed).toString("base64url").slice(0, 64),
        chunkIndex: 0,
        tokenCount: Math.ceil(trimmed.length / 4),
        metadata: { connectorManaged: true },
      },
    });

    await prisma.document.update({
      where: { id: documentId, organizationId },
      data: { chunkCount: 1, tokenCount: Math.ceil(trimmed.length / 4) },
    });
  }
}

export const connectorService = new ConnectorService();
