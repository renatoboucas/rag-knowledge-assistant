import type { Prisma } from "@prisma/client";

import type { DbClient } from "@/lib/db/types/prisma";
import type { CreateChunkInput, CreateDocumentInput, TenantScope } from "@/lib/db/types/rag";

export class DocumentRepository {
  constructor(private readonly db: DbClient) {}

  createDocument(input: CreateDocumentInput) {
    return this.db.document.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: input.title,
        sourceType: input.sourceType,
        sourceUri: input.sourceUri,
        mimeType: input.mimeType,
        checksum: input.checksum,
        status: input.status,
        metadata: input.metadata ?? {},
      },
    });
  }

  findDocumentById(scope: TenantScope, id: string) {
    return this.db.document.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: { chunks: { where: { deletedAt: null }, orderBy: { chunkIndex: "asc" } } },
    });
  }

  listDocuments(scope: TenantScope, options?: { take?: number; skip?: number }) {
    return this.db.document.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: options?.take ?? 50,
      skip: options?.skip,
    });
  }

  createChunk(input: CreateChunkInput) {
    return this.db.documentChunk.create({
      data: {
        organizationId: input.organizationId,
        documentId: input.documentId,
        content: input.content,
        contentHash: input.contentHash,
        chunkIndex: input.chunkIndex,
        tokenCount: input.tokenCount ?? 0,
        startChar: input.startChar,
        endChar: input.endChar,
        metadata: input.metadata ?? {},
      },
    });
  }

  createChunks(inputs: CreateChunkInput[]) {
    return this.db.documentChunk.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        documentId: input.documentId,
        content: input.content,
        contentHash: input.contentHash,
        chunkIndex: input.chunkIndex,
        tokenCount: input.tokenCount ?? 0,
        startChar: input.startChar,
        endChar: input.endChar,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }

  deleteChunksForDocument(scope: TenantScope, documentId: string) {
    return this.db.documentChunk.deleteMany({
      where: {
        organizationId: scope.organizationId,
        documentId,
      },
    });
  }

  updateDocumentStats(
    scope: TenantScope,
    documentId: string,
    stats: { chunkCount: number; tokenCount: number },
  ) {
    return this.db.document.update({
      where: { id: documentId, organizationId: scope.organizationId },
      data: {
        chunkCount: stats.chunkCount,
        tokenCount: stats.tokenCount,
        status: "INDEXED",
      },
    });
  }

  updateDocumentProcessingState(
    scope: TenantScope,
    documentId: string,
    state: {
      status: "PENDING" | "PROCESSING" | "INDEXED" | "FAILED" | "ARCHIVED";
      errorMessage?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.db.document.update({
      where: { id: documentId, organizationId: scope.organizationId },
      data: {
        status: state.status,
        errorMessage: state.errorMessage,
        metadata: state.metadata,
      },
    });
  }

  softDeleteDocument(scope: TenantScope, documentId: string) {
    const deletedAt = new Date();

    return this.db.document.update({
      where: { id: documentId, organizationId: scope.organizationId },
      data: {
        deletedAt,
        status: "ARCHIVED",
        chunks: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt },
          },
        },
      },
    });
  }
}
