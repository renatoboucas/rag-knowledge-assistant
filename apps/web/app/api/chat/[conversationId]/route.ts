import { NextResponse } from "next/server";

import { ConversationRepository } from "@/lib/db/repositories/conversation-repository";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const context = await getSessionContext();
  const { conversationId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:read",
    action: "conversation.read",
    resource: "api.chat.conversation",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const conversation = await new ConversationRepository(prisma).findConversationById(
    { organizationId: context.workspace.id },
    conversationId,
  );

  if (!conversation) {
    return NextResponse.json({ message: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        createdAt: message.createdAt,
      })),
    },
  });
}
