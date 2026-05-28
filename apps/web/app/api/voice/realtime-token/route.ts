import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { voiceOrchestration } from "@/lib/voice";

export const runtime = "nodejs";

const tokenSchema = z.object({
  sessionId: z.string().min(1),
  model: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
  instructions: z.string().min(1).max(4000).optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = tokenSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid realtime token payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "voice:manage",
    action: "voice.realtime_token.create",
    resource: "voice_sessions",
    rateLimit: "ai",
    prompt: parsed.data.instructions,
  });

  if (security) {
    return security;
  }

  try {
    const realtime = await voiceOrchestration.createRealtimeToken({
      organizationId: context.workspace.id,
      userId: context.user.id,
      sessionId: parsed.data.sessionId,
      request,
      config: {
        model: parsed.data.model,
        voice: parsed.data.voice,
        instructions: parsed.data.instructions,
      },
    });

    return NextResponse.json({ realtime });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create realtime token." },
      { status: 502 },
    );
  }
}
