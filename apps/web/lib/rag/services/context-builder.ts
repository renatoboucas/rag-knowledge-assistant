import type { Citation, RankedContext } from "@/lib/rag/types/retrieval";
import { env } from "@/lib/env";
import { estimateTokenCount, truncateToTokenBudget } from "@/lib/memory/token-counter";

export class ContextBuilder {
  build(results: RankedContext[], options?: { maxTokens?: number }) {
    const maxTokens = options?.maxTokens ?? env.RAG_CONTEXT_MAX_TOKENS;
    let remaining = maxTokens;
    const selected: RankedContext[] = [];

    for (const result of results) {
      const tokenCost = estimateTokenCount(result.content) + 24;

      if (selected.length && tokenCost > remaining) {
        continue;
      }

      selected.push(result);
      remaining -= Math.min(tokenCost, remaining);
    }

    const citations: Citation[] = selected.map((result, index) => ({
      id: result.citationId,
      documentId: result.documentId,
      chunkId: result.chunkId,
      title: result.documentTitle,
      sourceUri: result.sourceUri,
      similarity: result.similarity,
      rank: index + 1,
    }));

    const contextText = selected
      .map((result) => {
        const perChunkBudget = Math.max(160, Math.floor(maxTokens / Math.max(selected.length, 1)));
        const content = truncateToTokenBudget(result.content, perChunkBudget);

        return [
          `[${result.citationId}] ${result.documentTitle}`,
          `Similarity: ${result.similarity.toFixed(4)}`,
          `Rerank: ${result.rerankScore.toFixed(4)}`,
          result.sourceQueries?.length
            ? `Matched queries: ${result.sourceQueries.join(" | ")}`
            : "",
          content,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n---\n\n");

    return { contextText, citations };
  }
}
