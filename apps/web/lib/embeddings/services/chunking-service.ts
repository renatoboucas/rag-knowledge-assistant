import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import type { CreateChunkInput } from "@/lib/db/types/rag";
import type { ChunkingConfig } from "@/lib/embeddings/types/embedding";

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export class RecursiveChunkingService {
  constructor(
    private readonly config: ChunkingConfig = {
      chunkSize: env.CHUNK_SIZE,
      chunkOverlap: env.CHUNK_OVERLAP,
    },
  ) {}

  async chunk(input: {
    organizationId: string;
    documentId: string;
    text: string;
    metadata?: Prisma.InputJsonObject;
  }): Promise<CreateChunkInput[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      separators: this.config.separators,
    });
    const documents = await splitter.createDocuments([input.text], [input.metadata ?? {}]);

    const chunks: CreateChunkInput[] = [];

    documents.forEach((document, index) => {
      const content = document.pageContent.trim();

      if (!content) {
        return;
      }

      chunks.push({
        organizationId: input.organizationId,
        documentId: input.documentId,
        content,
        contentHash: hashContent(content),
        chunkIndex: index,
        tokenCount: estimateTokens(content),
        metadata: {
          ...document.metadata,
          splitter: "RecursiveCharacterTextSplitter",
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        },
      });
    });

    return chunks;
  }
}

export const recursiveChunkingService = new RecursiveChunkingService();
