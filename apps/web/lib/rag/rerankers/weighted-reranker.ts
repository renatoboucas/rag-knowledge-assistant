import type { Reranker } from "@/lib/rag/rerankers/reranker";

export class WeightedReranker implements Reranker {
  async rerank(input: Parameters<Reranker["rerank"]>[0]) {
    const queryTerms = new Set(input.query.keywords);
    const seenDocuments = new Map<string, number>();

    return input.results
      .map((result, index) => {
        const content = result.content.toLowerCase();
        const keywordHits = [...queryTerms].filter((term) => content.includes(term)).length;
        const keywordScore = queryTerms.size ? keywordHits / queryTerms.size : 0;
        const baseScore = result.rankScore ?? result.similarity;
        const documentSeenCount = seenDocuments.get(result.documentId) ?? 0;
        seenDocuments.set(result.documentId, documentSeenCount + 1);

        const diversityPenalty = documentSeenCount * (input.diversityBoost ?? 0.025);
        const strategyBoost = result.retrievalStrategy === "bm25" ? 0.015 : 0;
        const rerankScore =
          baseScore * 0.74 +
          keywordScore * 0.18 +
          (1 / (index + 1)) * 0.05 +
          strategyBoost -
          diversityPenalty;

        return {
          ...result,
          citationId: `S${index + 1}`,
          rerankScore,
        };
      })
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, input.limit)
      .map((result, index) => ({ ...result, citationId: `S${index + 1}` }));
  }
}
