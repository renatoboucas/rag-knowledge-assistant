import { OpenAIEmbeddings } from "@langchain/openai";

import { env } from "@/lib/env";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai" as const;
  readonly model: string;
  readonly dimensions: number;

  private readonly embeddings: OpenAIEmbeddings;

  constructor(options?: {
    model?: string;
    dimensions?: number;
    apiKey?: string;
    maxRetries?: number;
  }) {
    this.model = options?.model ?? env.EMBEDDING_MODEL;
    this.dimensions = options?.dimensions ?? env.EMBEDDING_DIMENSIONS;

    if (!options?.apiKey && !env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI embedding generation.");
    }

    this.embeddings = new OpenAIEmbeddings({
      apiKey: options?.apiKey ?? env.OPENAI_API_KEY,
      model: this.model,
      dimensions: this.dimensions,
      maxRetries: options?.maxRetries ?? 2,
    });
  }

  embedDocuments(texts: string[]) {
    return this.embeddings.embedDocuments(texts);
  }
}
