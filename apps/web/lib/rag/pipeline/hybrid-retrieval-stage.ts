import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import type { RetrievalStage, RetrievalStageInput } from "@/lib/rag/pipeline/retrieval-stage";

export class HybridRetrievalStage implements RetrievalStage {
  readonly name = "hybrid-vector-bm25";

  constructor(private readonly embeddings: EmbeddingRepository) {}

  async retrieve(input: RetrievalStageInput) {
    const [semantic, keyword] = await Promise.all([
      input.mode === "semantic"
        ? this.embeddings.similaritySearch({
            organizationId: input.organizationId,
            vector: input.vector,
            provider: input.provider,
            model: input.model,
            limit: input.limit,
            minSimilarity: input.minSimilarity,
            metadataFilter: input.metadataFilter,
          })
        : this.embeddings.hybridSearch({
            organizationId: input.organizationId,
            vector: input.vector,
            query: input.query.normalizedQuery,
            provider: input.provider,
            model: input.model,
            limit: input.limit,
            minSimilarity: input.minSimilarity,
            metadataFilter: input.metadataFilter,
          }),
      this.embeddings.keywordSearch({
        organizationId: input.organizationId,
        vector: input.vector,
        query: input.query.normalizedQuery,
        provider: input.provider,
        model: input.model,
        limit: input.limit,
        metadataFilter: input.metadataFilter,
      }),
    ]);

    return {
      stage: this.name,
      query: input.query,
      results: [...semantic, ...keyword],
    };
  }
}
