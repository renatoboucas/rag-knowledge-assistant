import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const governanceSchema = z.object({
  dataRegion: z.string().trim().min(2).max(32).optional(),
  retentionDays: z.coerce.number().int().min(30).max(3650).optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "security:read",
    action: "governance.read",
    resource: "api.security.governance",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: context.workspace.id },
    select: {
      id: true,
      name: true,
      dataRegion: true,
      retentionDays: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    organization,
    policies: {
      promptInjectionProtection: env.SECURITY_BLOCK_PROMPT_INJECTION,
      contentModeration: env.SECURITY_ENABLE_MODERATION,
      defaultRateLimit: env.RATE_LIMIT_REQUESTS,
      aiRateLimit: env.AI_RATE_LIMIT_REQUESTS,
      rateLimitWindowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      defaultRetentionDays: env.DATA_RETENTION_DAYS,
    },
  });
}

export async function PUT(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "settings:update",
    action: "governance.update",
    resource: "api.security.governance",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = governanceSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid governance settings.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const organization = await prisma.organization.update({
    where: { id: context.workspace.id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      dataRegion: true,
      retentionDays: true,
      updatedAt: true,
    },
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "governance.update",
    resource: "organization",
    resourceId: organization.id,
    request,
    metadata: parsed.data,
  });

  return NextResponse.json({ organization });
}
