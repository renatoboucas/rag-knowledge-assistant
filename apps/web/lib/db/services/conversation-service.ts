import { prisma } from "@/lib/prisma";
import { ConversationRepository } from "@/lib/db/repositories/conversation-repository";
import type { CreateConversationInput, CreateMessageInput, TenantScope } from "@/lib/db/types/rag";
import { withTransaction } from "@/lib/db/transaction";

export class ConversationService {
  constructor(private readonly conversations = new ConversationRepository(prisma)) {}

  createConversation(input: CreateConversationInput) {
    return this.conversations.createConversation(input);
  }

  createMessage(input: CreateMessageInput) {
    return this.conversations.createMessage(input);
  }

  createConversationWithMessage(
    conversation: CreateConversationInput,
    message: Omit<CreateMessageInput, "conversationId">,
  ) {
    return withTransaction(async (tx) => {
      const conversations = new ConversationRepository(tx);
      const created = await conversations.createConversation(conversation);
      const createdMessage = await conversations.createMessage({
        ...message,
        conversationId: created.id,
      });

      return { conversation: created, message: createdMessage };
    });
  }

  getConversation(scope: TenantScope, conversationId: string) {
    return this.conversations.findConversationById(scope, conversationId);
  }
}
