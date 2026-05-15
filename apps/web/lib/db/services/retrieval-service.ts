import { prisma } from "@/lib/prisma";
import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import { RetrievalLogRepository } from "@/lib/db/repositories/retrieval-log-repository";
import type { UpsertEmbeddingInput, VectorSearchInput } from "@/lib/db/types/rag";
import { withTransaction } from "@/lib/db/transaction";

export class RetrievalService {
  constructor(
    private readonly embeddings = new EmbeddingRepository(prisma),
    private readonly logs = new RetrievalLogRepository(prisma),
  ) {}

  upsertEmbedding(input: UpsertEmbeddingInput) {
    return this.embeddings.upsertEmbedding(input);
  }

  async search(
    input: VectorSearchInput & {
      query: string;
      conversationId?: string;
      latencyStartedAt?: number;
    },
  ) {
    const startedAt = input.latencyStartedAt ?? Date.now();
    const results = await this.embeddings.similaritySearch(input);
    const latencyMs = Date.now() - startedAt;

    await withTransaction(async (tx) => {
      const logs = new RetrievalLogRepository(tx);

      await Promise.all(
        results.map((result, index) =>
          logs.createRetrievalLog({
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            query: input.query,
            documentId: result.documentId,
            chunkId: result.chunkId,
            embeddingId: result.embeddingId,
            provider: input.provider,
            model: input.model,
            similarity: result.similarity,
            rank: index + 1,
            latencyMs,
          }),
        ),
      );
    });

    return results;
  }
}
