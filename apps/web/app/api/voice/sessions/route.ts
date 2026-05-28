import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { voiceOrchestration } from "@/lib/voice";

export const runtime = "nodejs";

const createSessionSchema = z.object({
  conversationId: z.string().optional(),
  provider: z.enum(["openai_realtime", "elevenlabs", "deepgram"]).default("openai_realtime"),
  model: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
  instructions: z.string().min(1).max(4000).optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "voice:read",
    action: "voice.sessions.list",
    resource: "voice_sessions",
  });

  if (security) {
    return security;
  }

  const [sessions, capabilities] = await Promise.all([
    voiceOrchestration.listSessions(context.workspace.id),
    Promise.resolve(voiceOrchestration.capabilities()),
  ]);

  return NextResponse.json({ sessions, capabilities });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid voice session payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "voice:manage",
    action: "voice.sessions.create",
    resource: "voice_sessions",
    rateLimit: "ai",
    prompt: parsed.data.instructions,
  });

  if (security) {
    return security;
  }

  if (parsed.data.provider !== "openai_realtime") {
    return NextResponse.json(
      { message: "Only OpenAI Realtime WebRTC sessions are currently enabled." },
      { status: 422 },
    );
  }

  const session = await voiceOrchestration.createSession({
    organizationId: context.workspace.id,
    userId: context.user.id,
    conversationId: parsed.data.conversationId,
    request,
    config: {
      provider: parsed.data.provider,
      model: parsed.data.model,
      voice: parsed.data.voice,
      instructions: parsed.data.instructions,
    },
  });

  return NextResponse.json({ session }, { status: 201 });
}
