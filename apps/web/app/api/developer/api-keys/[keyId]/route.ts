import { NextResponse } from "next/server";

import { apiKeyService } from "@/lib/developer";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "developer:manage",
    action: "developer.api_keys.revoke",
    resource: "api.developer.api_keys",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const { keyId } = await params;
  const key = await apiKeyService.revokeApiKey({ organizationId: context.workspace.id, keyId });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "developer.api_keys.revoke",
    resource: "api_key",
    resourceId: key.id,
    request,
    metadata: { prefix: key.prefix },
  });

  return NextResponse.json({ key });
}
