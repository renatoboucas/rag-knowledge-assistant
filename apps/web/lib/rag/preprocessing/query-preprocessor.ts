import type { QueryPreprocessingResult } from "@/lib/rag/types/retrieval";

const stopWords = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
  "or",
  "to",
  "in",
  "on",
  "is",
  "are",
]);

export class QueryPreprocessor {
  preprocess(query: string): QueryPreprocessingResult {
    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const keywords = normalizedQuery
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 2 && !stopWords.has(token))
      .slice(0, 12);

    return {
      originalQuery: query,
      normalizedQuery,
      keywords,
    };
  }
}
