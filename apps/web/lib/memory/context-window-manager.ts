import { env } from "@/lib/env";
import { estimateTokenCount, truncateToTokenBudget } from "@/lib/memory/token-counter";
import type { MemoryContext, MemoryContextMessage } from "@/lib/memory/types";
import type { MemorySearchResult } from "@/lib/db/types/rag";

function formatMessage(message: MemoryContextMessage) {
  return `${message.role.toLowerCase()}: ${message.content}`;
}

function formatMemory(memory: MemorySearchResult, index: number) {
  const label = memory.type.toLowerCase().replace("_", " ");
  const content = memory.summary || memory.content;

  return `M${index + 1} (${label}, score ${memory.rankScore.toFixed(2)}): ${content}`;
}

export class ContextWindowManager {
  compose(input: {
    summary: string | null;
    semanticMemories: MemorySearchResult[];
    shortTermMessages: MemoryContextMessage[];
    maxTokens?: number;
  }): MemoryContext {
    const maxTokens = input.maxTokens ?? env.MEMORY_MAX_CONTEXT_TOKENS;
    const sections: string[] = [];
    let remaining = maxTokens;

    if (input.summary) {
      const summary = truncateToTokenBudget(input.summary, Math.min(600, remaining));
      sections.push(["Conversation summary:", summary].join("\n"));
      remaining -= estimateTokenCount(summary);
    }

    if (remaining > 200 && input.semanticMemories.length) {
      const memoryLines: string[] = [];

      for (const [index, memory] of input.semanticMemories.entries()) {
        const line = formatMemory(memory, index);
        const cost = estimateTokenCount(line);

        if (cost > remaining - 120) {
          break;
        }

        memoryLines.push(line);
        remaining -= cost;
      }

      if (memoryLines.length) {
        sections.push(["Relevant long-term memory:", ...memoryLines].join("\n"));
      }
    }

    if (remaining > 100 && input.shortTermMessages.length) {
      const recentLines = input.shortTermMessages.map(formatMessage);
      const recentText = truncateToTokenBudget(recentLines.join("\n\n"), remaining);
      sections.push(["Recent conversation:", recentText].join("\n"));
      remaining -= estimateTokenCount(recentText);
    }

    const contextText = sections.join("\n\n").trim();

    return {
      contextText,
      summary: input.summary,
      semanticMemories: input.semanticMemories,
      shortTermMessages: input.shortTermMessages,
      tokenEstimate: estimateTokenCount(contextText),
    };
  }
}
