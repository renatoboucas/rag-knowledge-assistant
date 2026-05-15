import { prisma } from "@/lib/prisma";
import { DocumentRepository } from "@/lib/db/repositories/document-repository";
import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import { withTransaction } from "@/lib/db/transaction";
import { env } from "@/lib/env";
import { createEmbeddingProvider } from "@/lib/embeddings/providers/provider-factory";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";

function batch<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: { retries: number; baseDelayMs: number },
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === options.retries) {
        break;
      }

      const delay = options.baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export class EmbeddingService {
  constructor(
    private readonly provider: EmbeddingProvider = createEmbeddingProvider(),
    private readonly embeddings = new EmbeddingRepository(prisma),
    private readonly documents = new DocumentRepository(prisma),
  ) {}

  async embedDocument(input: { organizationId: string; documentId: string }) {
    const document = await this.documents.findDocumentById(
      { organizationId: input.organizationId },
      input.documentId,
    );

    if (!document) {
      throw new Error("Document not found for embedding generation.");
    }

    if (!document.chunks.length) {
      throw new Error("Document has no chunks to embed.");
    }

    const chunks = document.chunks;
    let embeddedCount = 0;

    for (const chunkBatch of batch(chunks, env.EMBEDDING_BATCH_SIZE)) {
      const vectors = await withRetry(
        () => this.provider.embedDocuments(chunkBatch.map((chunk) => chunk.content)),
        {
          retries: 2,
          baseDelayMs: 500,
        },
      );

      if (vectors.some((vector) => vector.length !== this.provider.dimensions)) {
        throw new Error(
          `Embedding provider returned vectors that do not match expected dimension ${this.provider.dimensions}.`,
        );
      }

      await withTransaction(async (tx) => {
        const embeddings = new EmbeddingRepository(tx);

        await Promise.all(
          chunkBatch.map((chunk, index) =>
            embeddings.upsertEmbedding({
              organizationId: input.organizationId,
              chunkId: chunk.id,
              provider: this.provider.name,
              model: this.provider.model,
              dimensions: this.provider.dimensions,
              vector: vectors[index] ?? [],
              metadata: {
                source: "embedding-pipeline",
                chunkIndex: chunk.chunkIndex,
              },
            }),
          ),
        );
      });

      embeddedCount += chunkBatch.length;
    }

    await this.documents.updateDocumentProcessingState(
      { organizationId: input.organizationId },
      input.documentId,
      {
        status: "INDEXED",
        errorMessage: null,
        metadata: {
          ...(typeof document.metadata === "object" && document.metadata ? document.metadata : {}),
          embeddings: {
            provider: this.provider.name,
            model: this.provider.model,
            dimensions: this.provider.dimensions,
            embeddedCount,
          },
        },
      },
    );

    return {
      documentId: input.documentId,
      embeddedCount,
      provider: this.provider.name,
      model: this.provider.model,
      dimensions: this.provider.dimensions,
    };
  }
}
