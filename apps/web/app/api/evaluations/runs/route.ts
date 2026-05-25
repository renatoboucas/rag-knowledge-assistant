import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluationService } from "@/lib/evaluations";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const runSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  retrievalMode: z.enum(["semantic", "hybrid"]).default("hybrid"),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "evaluations:read",
    action: "evaluations.runs.read",
    resource: "api.evaluations.runs",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const runs = await evaluationService.listRuns(context.workspace.id);

  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "evaluations:write",
    action: "evaluations.runs.create",
    resource: "api.evaluations.runs",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = runSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid benchmark run payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const run = await evaluationService.runBenchmark({
    organizationId: context.workspace.id,
    ...parsed.data,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "evaluations.runs.create",
    resource: "evaluation_run",
    resourceId: run.id,
    request,
    metadata: { datasetId: parsed.data.datasetId, retrievalMode: parsed.data.retrievalMode },
  });

  return NextResponse.json({ run }, { status: 201 });
}
