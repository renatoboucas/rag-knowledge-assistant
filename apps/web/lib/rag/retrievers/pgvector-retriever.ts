import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";

import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import { prisma } from "@/lib/prisma";
import { createEmbeddingProvider } from "@/lib/embeddings/providers/provider-factory";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";
import type { RetrievalMode } from "@/lib/rag/types/retrieval";

type PgVectorRetrieverFields = {
  organizationId: string;
  mode?: RetrievalMode;
  limit?: number;
  minSimilarity?: number;
  provider?: EmbeddingProvider;
  embeddings?: EmbeddingRepository;
};

export class PgVectorRetriever extends BaseRetriever {
  lc_namespace = ["rag", "retrievers", "pgvector"];

  private readonly provider: EmbeddingProvider;
  private readonly embeddings: EmbeddingRepository;
  private readonly organizationId: string;
  private readonly mode: RetrievalMode;
  private readonly limit: number;
  private readonly minSimilarity: number;

  constructor(fields: PgVectorRetrieverFields) {
    super();
    this.organizationId = fields.organizationId;
    this.mode = fields.mode ?? "hybrid";
    this.limit = fields.limit ?? 8;
    this.minSimilarity = fields.minSimilarity ?? 0.2;
    this.provider = fields.provider ?? createEmbeddingProvider();
    this.embeddings = fields.embeddings ?? new EmbeddingRepository(prisma);
  }

  override async _getRelevantDocuments(query: string) {
    const [vector] = await this.provider.embedDocuments([query]);

    if (!vector) {
      return [];
    }

    const results =
      this.mode === "semantic"
        ? await this.embeddings.similaritySearch({
            organizationId: this.organizationId,
            vector,
            provider: this.provider.name,
            model: this.provider.model,
            limit: this.limit,
            minSimilarity: this.minSimilarity,
          })
        : await this.embeddings.hybridSearch({
            organizationId: this.organizationId,
            vector,
            query,
            provider: this.provider.name,
            model: this.provider.model,
            limit: this.limit,
            minSimilarity: this.minSimilarity,
          });

    return results.map(
      (result) =>
        new Document({
          pageContent: result.content,
          metadata: {
            embeddingId: result.embeddingId,
            chunkId: result.chunkId,
            documentId: result.documentId,
            title: result.documentTitle,
            sourceUri: result.sourceUri,
            similarity: result.similarity,
            rankScore: result.rankScore,
          },
        }),
    );
  }
}
