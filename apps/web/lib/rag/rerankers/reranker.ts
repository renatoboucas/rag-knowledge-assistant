import type { QueryPreprocessingResult, RankedContext } from "@/lib/rag/types/retrieval";
import type { VectorSearchResult } from "@/lib/db/types/rag";

export interface Reranker {
  rerank(input: {
    query: QueryPreprocessingResult;
    results: VectorSearchResult[];
    limit: number;
    diversityBoost?: number;
  }): Promise<RankedContext[]>;
}
