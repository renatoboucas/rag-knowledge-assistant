import type { DbClient } from "@/lib/db/types/prisma";
import type { CreateConversationInput, CreateMessageInput, TenantScope } from "@/lib/db/types/rag";

export class ConversationRepository {
  constructor(private readonly db: DbClient) {}

  createConversation(input: CreateConversationInput) {
    return this.db.conversation.create({
      data: {
        organizationId: input.organizationId,
        title: input.title,
        metadata: input.metadata ?? {},
      },
    });
  }

  findConversationById(scope: TenantScope, conversationId: string) {
    return this.db.conversation.findFirst({
      where: { id: conversationId, organizationId: scope.organizationId, deletedAt: null },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  listConversations(scope: TenantScope, options?: { take?: number; skip?: number }) {
    return this.db.conversation.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: options?.take ?? 50,
      skip: options?.skip,
    });
  }

  createMessage(input: CreateMessageInput) {
    return this.db.message.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        userId: input.userId,
        role: input.role,
        content: input.content,
        tokenCount: input.tokenCount ?? 0,
        metadata: input.metadata ?? {},
      },
    });
  }

  softDeleteConversation(scope: TenantScope, conversationId: string) {
    const deletedAt = new Date();

    return this.db.conversation.update({
      where: { id: conversationId, organizationId: scope.organizationId },
      data: {
        deletedAt,
        status: "ARCHIVED",
        messages: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt },
          },
        },
      },
    });
  }
}
