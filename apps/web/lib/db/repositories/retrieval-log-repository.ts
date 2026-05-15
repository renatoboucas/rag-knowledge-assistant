import type { DbClient } from "@/lib/db/types/prisma";
import type { CreateRetrievalLogInput, TenantScope } from "@/lib/db/types/rag";

export class RetrievalLogRepository {
  constructor(private readonly db: DbClient) {}

  createRetrievalLog(input: CreateRetrievalLogInput) {
    return this.db.retrievalLog.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        embeddingId: input.embeddingId,
        query: input.query,
        provider: input.provider,
        model: input.model,
        similarity: input.similarity,
        rank: input.rank,
        latencyMs: input.latencyMs,
        metadata: input.metadata ?? {},
      },
    });
  }

  listForConversation(scope: TenantScope, conversationId: string) {
    return this.db.retrievalLog.findMany({
      where: {
        organizationId: scope.organizationId,
        conversationId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
