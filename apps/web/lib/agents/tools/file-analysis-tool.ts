import { z } from "zod";

import type { ToolDefinition } from "@/lib/agents/types";
import { prisma } from "@/lib/prisma";

const fileAnalysisSchema = z.object({
  documentId: z.string().optional(),
  query: z.string().max(300).optional(),
  includeChunks: z.boolean().optional(),
});

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const fileAnalysisTool: ToolDefinition = {
  name: "file_analysis",
  description:
    "Inspect uploaded knowledge-base files, metadata, processing state, chunks, and document statistics.",
  parameters: fileAnalysisSchema,
  async execute(input, context) {
    const documents = await prisma.document.findMany({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
        ...(input.documentId ? { id: input.documentId } : {}),
        ...(input.query
          ? {
              title: {
                contains: input.query,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        chunks: {
          where: { deletedAt: null },
          orderBy: { chunkIndex: "asc" },
          take: input.includeChunks ? 8 : 0,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: input.documentId ? 1 : 10,
    });

    return {
      count: documents.length,
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        status: document.status,
        sourceType: document.sourceType,
        sourceUri: document.sourceUri,
        mimeType: document.mimeType,
        chunkCount: document.chunkCount,
        tokenCount: document.tokenCount,
        errorMessage: document.errorMessage,
        metadata: metadataObject(document.metadata),
        updatedAt: document.updatedAt,
        chunks: document.chunks.map((chunk) => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount,
          content: chunk.content.slice(0, 1200),
          metadata: metadataObject(chunk.metadata),
        })),
      })),
    };
  },
};
