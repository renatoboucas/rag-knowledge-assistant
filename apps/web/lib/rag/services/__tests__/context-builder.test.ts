import { describe, expect, it } from "vitest";

import { ContextBuilder } from "@/lib/rag/services/context-builder";
import type { RankedContext } from "@/lib/rag/types/retrieval";

function result(index: number, content: string): RankedContext {
  return {
    documentId: `doc-${index}`,
    chunkId: `chunk-${index}`,
    embeddingId: `embedding-${index}`,
    documentTitle: `Document ${index}`,
    sourceUri: `https://example.com/${index}`,
    content,
    similarity: 0.9,
    rankScore: 0.9,
    rerankScore: 0.9,
    citationId: `S${index}`,
    metadata: {},
    documentMetadata: {},
  };
}

describe("ContextBuilder", () => {
  it("preserves citation metadata while respecting a context budget", () => {
    const built = new ContextBuilder().build(
      [result(1, "alpha ".repeat(200)), result(2, "beta ".repeat(200))],
      { maxTokens: 80 },
    );

    expect(built.citations).toHaveLength(1);
    expect(built.contextText).toContain("[S1]");
    expect(built.contextText.length).toBeLessThan(900);
  });
});
