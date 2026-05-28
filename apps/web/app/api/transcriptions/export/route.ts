import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { exportTranscript, transcriptService } from "@/lib/transcription";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const security = await enforceApiSecurity({
    request,
    context,
    permission: "transcription:read",
    action: "transcription.export",
    resource: "transcriptions",
  });

  if (security) {
    return security;
  }

  const url = new URL(request.url);
  const transcriptId = url.searchParams.get("transcriptId");
  const requestedFormat = url.searchParams.get("format");
  const format: "txt" | "json" | "vtt" =
    requestedFormat === "json" || requestedFormat === "vtt" ? requestedFormat : "txt";

  if (!transcriptId) {
    return NextResponse.json({ message: "transcriptId is required." }, { status: 400 });
  }

  const transcript = await transcriptService.getForExport(context.workspace.id, transcriptId);

  if (!transcript) {
    return NextResponse.json({ message: "Transcript not found." }, { status: 404 });
  }

  const exported = exportTranscript(transcript, format);

  return new Response(exported.body, {
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename=\"${transcript.title.replace(/[^a-z0-9_-]+/gi, "-")}.${exported.extension}\"`,
    },
  });
}
