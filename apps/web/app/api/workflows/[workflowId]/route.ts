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

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  triggerType: z.enum(["MANUAL", "SCHEDULE", "CONNECTOR_WEBHOOK", "DOCUMENT_CREATED"]).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(actionSchema).min(1).max(12).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const context = await getSessionContext();
  const { workflowId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "workflow.update",
    resource: "api.workflows",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid workflow payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await workflowService.update(context.workspace.id, workflowId, parsed.data);

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "workflow.update",
    resource: "workflow",
    resourceId: workflow.id,
    request,
    metadata: { triggerType: workflow.triggerType, status: workflow.status },
  });

  return NextResponse.json({ workflow });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const context = await getSessionContext();
  const { workflowId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "workflow.delete",
    resource: "api.workflows",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const workflow = await workflowService.archive(context.workspace.id, workflowId);

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "workflow.delete",
    resource: "workflow",
    resourceId: workflow.id,
    request,
    metadata: { triggerType: workflow.triggerType },
  });

  return NextResponse.json({ workflow });
}
