import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { transcriptService } from "@/lib/transcription";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z
    .enum(["created", "streaming", "processing", "completed", "failed", "cancelled"])
    .optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
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
      { message: "Invalid audio session update.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:manage",
    action: "transcription.sessions.update",
    resource: "transcriptions",
  });

  if (security) {
    return security;
  }

  const { sessionId } = await params;
  const audioSession = await transcriptService.updateAudioSession({
    organizationId: context.workspace.id,
    audioSessionId: sessionId,
    update: parsed.data,
  });

  return NextResponse.json({ audioSession });
}
