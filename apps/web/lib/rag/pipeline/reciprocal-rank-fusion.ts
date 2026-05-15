import type { VectorSearchResult } from "@/lib/db/types/rag";
import type { RetrievalStageResult } from "@/lib/rag/pipeline/retrieval-stage";

type FusedCandidate = VectorSearchResult & {
  sourceQueries: string[];
  retrievalStrategies: string[];
  rankScore: number;
  fusedScore: number;
  vectorRank?: number;
  keywordRank?: number;
};

export class ReciprocalRankFusion {
  fuse(stageResults: RetrievalStageResult[], options?: { limit?: number; k?: number }) {
    const k = options?.k ?? 60;
    const candidates = new Map<string, FusedCandidate>();

    for (const stageResult of stageResults) {
      stageResult.results.forEach((result, index) => {
        const existing = candidates.get(result.chunkId);
        const score = 1 / (k + index + 1);
        const strategy = result.retrievalStrategy ?? stageResult.stage;

        if (!existing) {
          candidates.set(result.chunkId, {
            ...result,
            sourceQueries: [stageResult.query.normalizedQuery],
            retrievalStrategies: [strategy],
            rankScore: score + (result.rankScore ?? result.similarity) * 0.08,
            fusedScore: score + (result.rankScore ?? result.similarity) * 0.08,
            vectorRank: strategy === "semantic" || strategy === "hybrid" ? index + 1 : undefined,
            keywordRank: strategy === "bm25" ? index + 1 : undefined,
          });
          return;
        }

        existing.rankScore += score + (result.rankScore ?? result.similarity) * 0.08;
        existing.fusedScore = existing.rankScore;
        existing.similarity = Math.max(existing.similarity, result.similarity);
        existing.textRank = Math.max(existing.textRank ?? 0, result.textRank ?? 0);

        if (!existing.sourceQueries.includes(stageResult.query.normalizedQuery)) {
          existing.sourceQueries.push(stageResult.query.normalizedQuery);
        }

        if (!existing.retrievalStrategies.includes(strategy)) {
          existing.retrievalStrategies.push(strategy);
        }

        if ((strategy === "semantic" || strategy === "hybrid") && !existing.vectorRank) {
          existing.vectorRank = index + 1;
        }

        if (strategy === "bm25" && !existing.keywordRank) {
          existing.keywordRank = index + 1;
        }
      });
    }

    return [...candidates.values()]
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, options?.limit);
  }
}
