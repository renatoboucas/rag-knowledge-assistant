import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { workflowQueue } from "@/lib/workflows/jobs/workflow-queue";
import { workflowService } from "@/lib/workflows/services/workflow-service";

export const runtime = "nodejs";

const runSchema = z.object({
  workflowId: z.string().min(1).optional(),
  mode: z.enum(["manual", "scheduled"]).default("manual"),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:read",
    action: "workflow.queue.read",
    resource: "api.workflows.run",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  return NextResponse.json({ queue: workflowQueue.snapshot(context.workspace.id) });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "workflow.run",
    resource: "api.workflows.run",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = runSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid workflow run payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.mode === "scheduled" && !parsed.data.workflowId) {
    const runs = await workflowService.enqueueDueScheduledWorkflows(context.workspace.id);

    for (const run of runs) {
      workflowQueue.enqueue({
        runId: run.id,
        workflowId: run.workflowId,
        organizationId: context.workspace.id,
      });
    }

    return NextResponse.json({ queued: runs.length }, { status: 202 });
  }

  if (!parsed.data.workflowId) {
    return NextResponse.json({ message: "workflowId is required." }, { status: 400 });
  }

  const run = await workflowService.createRun(context.workspace.id, parsed.data.workflowId, {
    triggerType: "MANUAL",
    payload: parsed.data.payload,
  });
  workflowQueue.enqueue({
    runId: run.id,
    workflowId: run.workflowId,
    organizationId: context.workspace.id,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "workflow.run",
    resource: "workflow",
    resourceId: run.workflowId,
    request,
    metadata: { runId: run.id, mode: parsed.data.mode },
  });

  return NextResponse.json({ run }, { status: 202 });
}
