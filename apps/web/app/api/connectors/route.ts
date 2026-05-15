import { NextResponse } from "next/server";
import { z } from "zod";

import { connectorService } from "@/lib/connectors/services/connector-service";
import { connectorRegistry } from "@/lib/connectors/providers/registry";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const connectorSchema = z.object({
  provider: z.enum(["GOOGLE_DRIVE", "NOTION", "CONFLUENCE", "SLACK", "GITHUB"]),
  name: z.string().trim().min(2).max(100),
  config: z.record(z.string(), z.unknown()).default({}),
  credentials: z.record(z.string(), z.unknown()).default({}),
  syncIntervalMin: z.coerce.number().int().min(5).max(1440).default(60),
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
    action: "connector.read",
    resource: "api.connectors",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const connectors = await connectorService.list(context.workspace.id);

  return NextResponse.json({
    providers: connectorRegistry.list().map((adapter) => ({
      provider: adapter.provider,
      sourceType: adapter.sourceType,
      displayName: adapter.displayName,
    })),
    connectors,
  });
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
    action: "connector.create",
    resource: "api.connectors",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = connectorSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid connector payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const connector = await connectorService.create({
    organizationId: context.workspace.id,
    userId: context.user.id,
    provider: parsed.data.provider,
    name: parsed.data.name,
    config: parsed.data.config,
    credentials: parsed.data.credentials,
    syncIntervalMin: parsed.data.syncIntervalMin,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "connector.create",
    resource: "connector",
    resourceId: connector.id,
    request,
    metadata: { provider: connector.provider },
  });

  return NextResponse.json({ connector }, { status: 201 });
}
