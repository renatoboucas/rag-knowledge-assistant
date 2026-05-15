import { env } from "@/lib/env";
import { OpenAIEmbeddingProvider } from "@/lib/embeddings/providers/openai-embedding-provider";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";

export function createEmbeddingProvider(): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER === "openai") {
    return new OpenAIEmbeddingProvider();
  }

  throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
}
