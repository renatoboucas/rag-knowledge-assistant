import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { workflowService } from "@/lib/workflows/services/workflow-service";

export const runtime = "nodejs";

const actionSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    "SYNC_CONNECTOR",
    "SYNC_ALL_CONNECTORS",
    "INGEST_PENDING_DOCUMENTS",
    "GENERATE_DOCUMENT_SUMMARIES",
  ]),
  name: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const workflowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("ACTIVE"),
  triggerType: z.enum(["MANUAL", "SCHEDULE", "CONNECTOR_WEBHOOK", "DOCUMENT_CREATED"]),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  actions: z.array(actionSchema).min(1).max(12),
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
    action: "workflow.read",
    resource: "api.workflows",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const workflows = await workflowService.list(context.workspace.id);

  return NextResponse.json({ workflows });
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
    action: "workflow.create",
    resource: "api.workflows",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = workflowSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid workflow payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await workflowService.create({
    organizationId: context.workspace.id,
    userId: context.user.id,
    ...parsed.data,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "workflow.create",
    resource: "workflow",
    resourceId: workflow.id,
    request,
    metadata: { triggerType: workflow.triggerType, status: workflow.status },
  });

  return NextResponse.json({ workflow }, { status: 201 });
}
