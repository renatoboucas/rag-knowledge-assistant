import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { LlmOrchestrator } from "@/lib/ai/llm-orchestrator";
import { modelMessageContent } from "@/lib/ai/message-content";
import { MemoryRepository } from "@/lib/db/repositories/memory-repository";
import { prisma } from "@/lib/prisma";
import { createEmbeddingProvider } from "@/lib/embeddings/providers/provider-factory";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";
import { env } from "@/lib/env";
import { ContextWindowManager } from "@/lib/memory/context-window-manager";
import { estimateTokenCount } from "@/lib/memory/token-counter";
import type {
  BuildMemoryContextInput,
  MemoryContextMessage,
  UpdateConversationMemoryInput,
} from "@/lib/memory/types";

function normalizeRecentMessages(messages: MemoryContextMessage[]) {
  return [...messages].reverse();
}

function toTranscript(messages: MemoryContextMessage[]) {
  return messages
    .map((message) => `${message.role.toLowerCase()} (${message.id}): ${message.content}`)
    .join("\n\n");
}

export class MemoryService {
  constructor(
    private readonly provider: EmbeddingProvider = createEmbeddingProvider(),
    private readonly memories = new MemoryRepository(prisma),
    private readonly contextWindow = new ContextWindowManager(),
    private readonly llm = new LlmOrchestrator(),
  ) {}

  async buildContext(input: BuildMemoryContextInput) {
    const [queryVector] = await this.provider.embedDocuments([input.query]);

    if (!queryVector) {
      throw new Error("Embedding provider did not return a memory query vector.");
    }

    const [summary, recentMessages, semanticMemories] = await Promise.all([
      this.memories.getLatestConversationSummary(
        { organizationId: input.organizationId },
        input.conversationId,
      ),
      this.memories.listRecentMessages(
        { organizationId: input.organizationId },
        input.conversationId,
        {
          take: env.MEMORY_RECENT_MESSAGE_LIMIT,
        },
      ),
      this.memories.searchSemanticMemory({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        vector: queryVector,
        types: ["LONG_TERM", "PREFERENCE", "FACT", "TASK", "SUMMARY"],
        limit: env.MEMORY_RETRIEVAL_LIMIT,
      }),
    ]);

    await this.memories.markAccessed(
      { organizationId: input.organizationId },
      semanticMemories.map((memory) => memory.id),
    );

    return this.contextWindow.compose({
      summary: summary?.summary ?? null,
      semanticMemories,
      shortTermMessages: normalizeRecentMessages(recentMessages),
    });
  }

  async updateAfterAssistantResponse(input: UpdateConversationMemoryInput) {
    const recentMessages = normalizeRecentMessages(
      await this.memories.listRecentMessages(
        { organizationId: input.organizationId },
        input.conversationId,
        { take: 40 },
      ),
    );
    const transcript = toTranscript(recentMessages);
    const inputTokenCount = estimateTokenCount(transcript);

    if (inputTokenCount < env.MEMORY_SUMMARY_TRIGGER_TOKENS) {
      return { summarized: false, memoryCreated: false };
    }

    const latestSummary = await this.memories.getLatestConversationSummary(
      { organizationId: input.organizationId },
      input.conversationId,
    );

    if (latestSummary?.coveredMessageIds.includes(input.assistantMessageId ?? "")) {
      return { summarized: false, memoryCreated: false };
    }

    const response = await this.llm.invoke({
      task: "summarization",
      strategy: "cost",
      temperature: 0,
      maxOutputTokens: 1200,
      messages: [
        new SystemMessage(
          [
            "You maintain enterprise assistant memory.",
            "Compress the conversation into durable, factual memory.",
            "Preserve user goals, decisions, constraints, unresolved tasks, names, and preferences.",
            "Do not invent facts. Keep it concise and useful for future turns.",
          ].join("\n"),
        ),
        new HumanMessage(
          [
            latestSummary
              ? `Previous summary:\n${latestSummary.summary}`
              : "Previous summary: none",
            "",
            "Recent transcript:",
            transcript,
          ].join("\n"),
        ),
      ],
    });

    const summary = modelMessageContent(response.content).trim();

    if (!summary) {
      return { summarized: false, memoryCreated: false };
    }

    const summaryTokenCount = estimateTokenCount(summary);
    const coveredMessageIds = recentMessages.map((message) => message.id);

    await this.memories.createConversationSummary({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      summary,
      messageCount: recentMessages.length,
      coveredMessageIds,
      inputTokenCount,
      summaryTokenCount,
      compressionRatio: summaryTokenCount / Math.max(inputTokenCount, 1),
      metadata: {
        source: "automatic-conversation-summarization",
        previousSummaryId: latestSummary?.id,
        model: response.route.selected,
      },
    });

    const [summaryVector] = await this.provider.embedDocuments([summary]);

    if (!summaryVector) {
      return { summarized: true, memoryCreated: false };
    }

    const memory = await this.memories.createMemoryItem({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      sourceMessageId: input.assistantMessageId,
      type: "SUMMARY",
      content: summary,
      summary,
      importance: 0.72,
      tokenCount: summaryTokenCount,
      provider: this.provider.name,
      model: this.provider.model,
      dimensions: this.provider.dimensions,
      vector: summaryVector,
      metadata: {
        source: "conversation-summary",
        userMessageId: input.userMessageId,
        assistantMessageId: input.assistantMessageId,
        model: response.route.selected,
        ...((typeof input.metadata === "object" && input.metadata) || {}),
      },
    });

    return { summarized: true, memoryCreated: true, memoryId: memory.id };
  }

  toModelMessages(messages: MemoryContextMessage[]) {
    return messages.map((message) => {
      if (message.role === "ASSISTANT") {
        return new AIMessage(message.content);
      }

      return new HumanMessage(message.content);
    });
  }
}
