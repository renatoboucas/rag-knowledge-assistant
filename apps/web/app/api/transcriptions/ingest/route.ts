import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { transcriptionOrchestration } from "@/lib/transcription";

export const runtime = "nodejs";

const ingestSchema = z.object({
  transcriptId: z.string().min(1),
  text: z.string().min(1),
  speakerLabel: z.string().optional(),
  language: z.string().optional(),
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
  words: z
    .array(
      z.object({
        text: z.string(),
        startMs: z.number().int().min(0),
        endMs: z.number().int().min(0),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = ingestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid transcript segment.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:manage",
    action: "transcription.segments.ingest",
    resource: "transcriptions",
    rateLimit: "ai",
  });

  if (security) {
    return security;
  }

  const segment = await transcriptionOrchestration.ingestSegment({
    organizationId: context.workspace.id,
    userId: context.user.id,
    segment: parsed.data,
    request,
  });

  if (!segment) {
    return NextResponse.json({ message: "Transcript not found." }, { status: 404 });
  }

  return NextResponse.json({ segment }, { status: 201 });
}
