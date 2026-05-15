import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { RagChatService } from "@/lib/rag/services/rag-chat-service";
import { ConversationRepository } from "@/lib/db/repositories/conversation-repository";
import { prisma } from "@/lib/prisma";
import { telemetry } from "@/lib/observability/telemetry";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const chatSchema = z.object({
  conversationId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = chatSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid chat payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const latestUserMessage = [...parsed.data.messages]
    .reverse()
    .find((message) => message.role === "user");
  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:read",
    action: "chat.create",
    resource: "api.chat",
    rateLimit: "ai",
    prompt: latestUserMessage?.content,
  });

  if (guard) {
    return guard;
  }

  try {
    const stream = await new RagChatService().stream({
      organizationId: context.workspace.id,
      userId: context.user.id,
      conversationId: parsed.data.conversationId,
      messages: parsed.data.messages,
    });

    await auditLog.record({
      organizationId: context.workspace.id,
      userId: context.user.id,
      action: "chat.create",
      resource: "conversation",
      resourceId: parsed.data.conversationId,
      request,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    await telemetry.captureError(error, {
      organizationId: context.workspace.id,
      userId: context.user.id,
      name: "api.chat.failed",
    });

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Chat request failed." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const conversations = await new ConversationRepository(prisma).listConversations({
    organizationId: context.workspace.id,
  });

  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      updatedAt: conversation.updatedAt,
      preview: conversation.messages[0]?.content ?? "",
    })),
  });
}
