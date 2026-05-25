import { NextResponse } from "next/server";

import { evaluationService } from "@/lib/evaluations";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "evaluations:read",
    action: "evaluations.runs.detail",
    resource: "api.evaluations.runs.detail",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const { runId } = await params;
  const run = await evaluationService.getRun(context.workspace.id, runId);

  return NextResponse.json({ run });
}
