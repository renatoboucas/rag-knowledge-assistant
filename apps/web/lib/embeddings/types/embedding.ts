import type { Prisma } from "@prisma/client";

export type EmbeddingProviderName = "openai";

export type ChunkingConfig = {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
};

export type EmbeddingConfig = {
  provider: EmbeddingProviderName;
  model: string;
  dimensions: number;
  batchSize: number;
  maxRetries: number;
};

export type EmbeddingInput = {
  id: string;
  content: string;
  metadata?: Prisma.JsonValue;
};

export type EmbeddingOutput = {
  id: string;
  vector: number[];
};

export type EmbedDocumentJob = {
  organizationId: string;
  documentId: string;
};

export interface EmbeddingProvider {
  readonly name: EmbeddingProviderName;
  readonly model: string;
  readonly dimensions: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
}
