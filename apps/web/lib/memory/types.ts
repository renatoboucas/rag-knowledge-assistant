import type { Message, Prisma } from "@prisma/client";
import type { MemorySearchResult } from "@/lib/db/types/rag";

export type MemoryContextMessage = Pick<Message, "id" | "role" | "content" | "createdAt">;

export type MemoryContext = {
  contextText: string;
  summary: string | null;
  semanticMemories: MemorySearchResult[];
  shortTermMessages: MemoryContextMessage[];
  tokenEstimate: number;
};

export type BuildMemoryContextInput = {
  organizationId: string;
  conversationId: string;
  query: string;
};

export type UpdateConversationMemoryInput = {
  organizationId: string;
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  userMessage: string;
  assistantMessage: string;
  metadata?: Prisma.InputJsonValue;
};
