import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { transcriptService } from "@/lib/transcription";

export const runtime = "nodejs";

const correctionSchema = z.object({
  correctedText: z.string().min(1),
  reason: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = correctionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid correction payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:manage",
    action: "transcription.segments.correct",
    resource: "transcriptions",
    prompt: parsed.data.correctedText,
  });

  if (security) {
    return security;
  }

  const { segmentId } = await params;
  const segment = await transcriptService.correctSegment({
    organizationId: context.workspace.id,
    segmentId,
    correction: parsed.data,
  });

  if (!segment) {
    return NextResponse.json({ message: "Transcript segment not found." }, { status: 404 });
  }

  return NextResponse.json({ segment });
}
