import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

function boundedTake(value: string | null) {
  const parsed = Number(value ?? 100);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 250) : 100;
}

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "security:audit",
    action: "audit_log.read",
    resource: "api.security.audit_logs",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  const take = boundedTake(url.searchParams.get("limit"));
  const action = url.searchParams.get("action")?.trim() || undefined;
  const outcome = url.searchParams.get("outcome")?.trim() || undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: context.workspace.id,
      ...(action ? { action } : {}),
      ...(outcome ? { outcome } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
        },
      },
    },
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "audit_log.read",
    resource: "audit_log",
    request,
    metadata: { count: logs.length },
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      outcome: log.outcome,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user,
    })),
  });
}
