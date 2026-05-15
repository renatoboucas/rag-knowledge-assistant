import type { Prisma } from "@prisma/client";
import type { VectorSearchResult } from "@/lib/db/types/rag";
import type { DecomposedQuery, RetrievalMode } from "@/lib/rag/types/retrieval";

export type RetrievalStageInput = {
  organizationId: string;
  query: DecomposedQuery;
  vector: number[];
  provider: string;
  model: string;
  mode: RetrievalMode;
  limit: number;
  minSimilarity: number;
  metadataFilter?: Prisma.InputJsonObject;
};

export type RetrievalStageResult = {
  stage: string;
  query: DecomposedQuery;
  results: VectorSearchResult[];
};

export interface RetrievalStage {
  readonly name: string;
  retrieve(input: RetrievalStageInput): Promise<RetrievalStageResult>;
}
