import { z } from "zod";

import type { ToolDefinition } from "@/lib/agents/types";
import { RetrievalEngine } from "@/lib/rag/services/retrieval-engine";

const knowledgeRetrievalSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().positive().max(12).optional(),
});

export function createKnowledgeRetrievalTool(retrieval = new RetrievalEngine()) {
  return {
    name: "knowledge_retrieval",
    description:
      "Retrieve grounded passages from the tenant knowledge base. Use for company documents, uploaded files, and RAG citations.",
    parameters: knowledgeRetrievalSchema,
    async execute(input, context) {
      const result = await retrieval.retrieve({
        organizationId: context.organizationId,
        conversationId: context.conversationId,
        query: input.query,
        mode: "hybrid",
        limit: input.limit ?? 6,
      });

      return {
        query: result.query.normalizedQuery,
        evaluation: result.evaluation,
        citations: result.citations,
        passages: result.results.map((item) => ({
          citationId: item.citationId,
          documentId: item.documentId,
          chunkId: item.chunkId,
          title: item.documentTitle,
          sourceUri: item.sourceUri,
          similarity: item.similarity,
          content: item.content.slice(0, 1200),
        })),
      };
    },
  } satisfies ToolDefinition;
}
