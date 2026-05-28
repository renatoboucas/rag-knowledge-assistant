import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { voiceOrchestration } from "@/lib/voice";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z
    .enum(["initializing", "connecting", "listening", "speaking", "interrupted", "ended", "failed"])
    .optional(),
  transcriptItem: z
    .object({
      role: z.enum(["user", "assistant", "system"]),
      text: z.string().min(1),
      startedAt: z.string().optional(),
      endedAt: z.string().optional(),
    })
    .optional(),
  metrics: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid voice session update.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { sessionId } = await params;
  const security = await enforceApiSecurity({
    request,
    context,
    permission: "voice:manage",
    action: "voice.sessions.update",
    resource: "voice_sessions",
  });

  if (security) {
    return security;
  }

  const session = await voiceOrchestration.updateSession({
    organizationId: context.workspace.id,
    userId: context.user.id,
    sessionId,
    update: parsed.data,
    request,
  });

  if (!session) {
    return NextResponse.json({ message: "Voice session not found." }, { status: 404 });
  }

  return NextResponse.json({ session });
}
