import { SystemMessage } from "@langchain/core/messages";

import { LlmOrchestrator } from "@/lib/ai/llm-orchestrator";
import { modelMessageContent } from "@/lib/ai/message-content";
import { ConversationRepository } from "@/lib/db/repositories/conversation-repository";
import { prisma } from "@/lib/prisma";
import { MemoryService } from "@/lib/memory/memory-service";
import { RetrievalEngine } from "@/lib/rag/services/retrieval-engine";
import type { ChatRequestMessage, Citation } from "@/lib/rag/types/retrieval";

export class RagChatService {
  constructor(
    private readonly retrieval = new RetrievalEngine(),
    private readonly conversations = new ConversationRepository(prisma),
    private readonly memory = new MemoryService(),
    private readonly llm = new LlmOrchestrator(),
  ) {}

  async stream(input: {
    organizationId: string;
    userId: string;
    messages: ChatRequestMessage[];
    conversationId?: string;
  }) {
    const latestUserMessage = [...input.messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage?.content.trim()) {
      throw new Error("A user message is required.");
    }

    const conversation = input.conversationId
      ? await this.conversations.findConversationById(
          { organizationId: input.organizationId },
          input.conversationId,
        )
      : await this.conversations.createConversation({
          organizationId: input.organizationId,
          title: latestUserMessage.content.slice(0, 80),
          metadata: { source: "rag-chat" },
        });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const userMessage = await this.conversations.createMessage({
      organizationId: input.organizationId,
      conversationId: conversation.id,
      userId: input.userId,
      role: "USER",
      content: latestUserMessage.content,
    });

    const [retrieval, memoryContext] = await Promise.all([
      this.retrieval.retrieve({
        organizationId: input.organizationId,
        conversationId: conversation.id,
        query: latestUserMessage.content,
        mode: "hybrid",
      }),
      this.memory.buildContext({
        organizationId: input.organizationId,
        conversationId: conversation.id,
        query: latestUserMessage.content,
      }),
    ]);

    const messages = [
      new SystemMessage(
        [
          "You are an enterprise RAG assistant.",
          "Answer using only the retrieved context.",
          "Cite sources inline using citation ids like [S1].",
          "If the context is insufficient, say what is missing.",
          "Do not use outside knowledge for factual claims.",
          "If retrieval quality is medium or high risk, explicitly qualify uncertainty.",
          "Use conversation memory only to preserve continuity and user preferences.",
          "",
          "Retrieval evaluation:",
          JSON.stringify(retrieval.evaluation),
          "",
          "Conversation memory:",
          memoryContext.contextText || "No relevant conversation memory is available.",
          "",
          "Retrieved context:",
          retrieval.contextText || "No relevant context was retrieved.",
        ].join("\n"),
      ),
      ...this.memory.toModelMessages(memoryContext.shortTermMessages),
    ];
    const { stream, route } = await this.llm.stream({
      task: "rag-chat",
      messages,
      temperature: 0.2,
      maxOutputTokens: 4096,
    });

    let answer = "";
    const encoder = new TextEncoder();
    const citations: Citation[] = retrieval.citations;
    const conversations = this.conversations;
    const memory = this.memory;
    const organizationId = input.organizationId;
    const conversationId = conversation.id;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: meta\ndata: ${JSON.stringify({ conversationId, citations, model: route.selected })}\n\n`,
            ),
          );

          for await (const chunk of stream) {
            const text = modelMessageContent(
              typeof chunk === "object" && chunk && "content" in chunk ? chunk.content : chunk,
            );

            if (!text) {
              continue;
            }

            answer += text;
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ text })}\n\n`),
            );
          }

          const assistantMessage = await conversations.createMessage({
            organizationId,
            conversationId,
            role: "ASSISTANT",
            content: answer,
            metadata: { citations, model: route.selected, routing: route },
          });

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ conversationId, citations })}\n\n`,
            ),
          );

          try {
            const memoryResult = await memory.updateAfterAssistantResponse({
              organizationId,
              conversationId,
              userMessageId: userMessage.id,
              assistantMessageId: assistantMessage.id,
              userMessage: latestUserMessage.content,
              assistantMessage: answer,
              metadata: { citations },
            });

            controller.enqueue(
              encoder.encode(`event: memory\ndata: ${JSON.stringify(memoryResult)}\n\n`),
            );
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `event: memory\ndata: ${JSON.stringify({
                  summarized: false,
                  memoryCreated: false,
                  warning:
                    error instanceof Error ? error.message : "Conversation memory update failed.",
                })}\n\n`,
              ),
            );
          }

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: error instanceof Error ? error.message : "RAG stream failed.",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });
  }
}
