import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { transcriptionOrchestration } from "@/lib/transcription";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  provider: z.enum(["deepgram", "whisper", "assemblyai"]).optional(),
  language: z.string().min(2).max(12).optional(),
  sampleRate: z.number().int().positive().optional(),
  speakerDetection: z.boolean().optional(),
  multiLanguage: z.boolean().optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:read",
    action: "transcription.sessions.list",
    resource: "transcriptions",
  });

  if (security) {
    return security;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const [transcripts, capabilities] = await Promise.all([
    transcriptionOrchestration.list({ organizationId: context.workspace.id, query }),
    Promise.resolve(transcriptionOrchestration.capabilities()),
  ]);

  return NextResponse.json({ transcripts, capabilities });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid transcription session payload.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:manage",
    action: "transcription.sessions.create",
    resource: "transcriptions",
    rateLimit: "ai",
  });

  if (security) {
    return security;
  }

  const session = await transcriptionOrchestration.createSession({
    organizationId: context.workspace.id,
    userId: context.user.id,
    title: parsed.data.title,
    config: parsed.data,
    request,
  });

  return NextResponse.json(session, { status: 201 });
}
