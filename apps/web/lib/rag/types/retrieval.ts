import type { Prisma } from "@prisma/client";
import type { VectorSearchResult } from "@/lib/db/types/rag";

export type RetrievalMode = "semantic" | "hybrid";

export type QueryPreprocessingResult = {
  originalQuery: string;
  normalizedQuery: string;
  keywords: string[];
};

export type DecomposedQuery = QueryPreprocessingResult & {
  id: string;
  parentQuery: string;
  strategy: "original" | "keyword" | "decomposed";
};

export type RetrievalRequest = {
  organizationId: string;
  conversationId?: string;
  query: string;
  mode?: RetrievalMode;
  limit?: number;
  minSimilarity?: number;
  metadataFilter?: Prisma.InputJsonObject;
  enableQueryDecomposition?: boolean;
  enableMultiQuery?: boolean;
};

export type RankedContext = VectorSearchResult & {
  citationId: string;
  rerankScore: number;
  fusedScore?: number;
  sourceQueries?: string[];
  retrievalStrategies?: string[];
};

export type RetrievalEvaluation = {
  groundedness: number;
  coverage: number;
  diversity: number;
  risk: "low" | "medium" | "high";
  warnings: string[];
};

export type RetrievalContext = {
  query: QueryPreprocessingResult;
  queries: DecomposedQuery[];
  results: RankedContext[];
  contextText: string;
  citations: Citation[];
  evaluation: RetrievalEvaluation;
};

export type Citation = {
  id: string;
  documentId: string;
  chunkId: string;
  title: string;
  sourceUri: string | null;
  similarity: number;
  rank: number;
};

export type ChatRequestMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
