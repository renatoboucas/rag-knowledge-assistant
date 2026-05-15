import { NextResponse } from "next/server";
import { z } from "zod";

import { connectorSyncQueue } from "@/lib/connectors/jobs/connector-sync-queue";
import { connectorService } from "@/lib/connectors/services/connector-service";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const syncSchema = z.object({
  connectorId: z.string().min(1).optional(),
  mode: z.enum(["manual", "scheduled"]).default("manual"),
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
    action: "connector.sync_queue.read",
    resource: "api.connectors.sync",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  return NextResponse.json({ queue: connectorSyncQueue.snapshot(context.workspace.id) });
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
    action: "connector.sync",
    resource: "api.connectors.sync",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid sync payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.mode === "scheduled" && !parsed.data.connectorId) {
    const queued = await connectorService.enqueueDueSyncs(context.workspace.id);
    return NextResponse.json({ queued });
  }

  if (!parsed.data.connectorId) {
    return NextResponse.json({ message: "connectorId is required." }, { status: 400 });
  }

  const job = await connectorService.createSyncJob(
    context.workspace.id,
    parsed.data.connectorId,
    parsed.data.mode,
  );
  connectorSyncQueue.enqueue({
    jobId: job.id,
    connectorId: job.connectorId,
    organizationId: context.workspace.id,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "connector.sync",
    resource: "connector",
    resourceId: job.connectorId,
    request,
    metadata: { jobId: job.id, mode: parsed.data.mode },
  });

  return NextResponse.json({ job }, { status: 202 });
}
