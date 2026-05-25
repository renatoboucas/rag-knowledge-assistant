import { NextResponse } from "next/server";
import { z } from "zod";

import { apiKeyService } from "@/lib/developer";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const createKeySchema = z.object({
  name: z.string().trim().min(2).max(120),
  scopes: z
    .array(z.enum(["documents:read", "retrieval:read", "chat:write", "evaluations:read"]))
    .min(1)
    .max(10)
    .default(["documents:read", "retrieval:read"]),
  rateLimitPerMinute: z.number().int().min(10).max(1000).default(60),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "developer:read",
    action: "developer.api_keys.read",
    resource: "api.developer.api_keys",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  return NextResponse.json(await apiKeyService.listApiKeys(context.workspace.id));
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "developer:manage",
    action: "developer.api_keys.create",
    resource: "api.developer.api_keys",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = createKeySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid API key payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = await apiKeyService.createApiKey({
    organizationId: context.workspace.id,
    createdById: context.user.id,
    name: parsed.data.name,
    scopes: parsed.data.scopes,
    rateLimitPerMinute: parsed.data.rateLimitPerMinute,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "developer.api_keys.create",
    resource: "api_key",
    resourceId: created.key.id,
    request,
    metadata: { scopes: created.key.scopes, prefix: created.key.prefix },
  });

  return NextResponse.json(created, { status: 201 });
}
