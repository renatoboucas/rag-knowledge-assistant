import { NextResponse } from "next/server";
import { z } from "zod";

import { connectorService } from "@/lib/connectors/services/connector-service";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
  syncIntervalMin: z.coerce.number().int().min(5).max(1440).optional(),
  status: z.enum(["CONNECTED", "PAUSED"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ connectorId: string }> },
) {
  const context = await getSessionContext();
  const { connectorId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "connector.update",
    resource: "api.connectors",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid connector payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const connector = await connectorService.update(context.workspace.id, connectorId, parsed.data);

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "connector.update",
    resource: "connector",
    resourceId: connector.id,
    request,
    metadata: { provider: connector.provider },
  });

  return NextResponse.json({ connector });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ connectorId: string }> },
) {
  const context = await getSessionContext();
  const { connectorId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "connector.delete",
    resource: "api.connectors",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const connector = await connectorService.archive(context.workspace.id, connectorId);

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "connector.delete",
    resource: "connector",
    resourceId: connector.id,
    request,
    metadata: { provider: connector.provider },
  });

  return NextResponse.json({ connector });
}
