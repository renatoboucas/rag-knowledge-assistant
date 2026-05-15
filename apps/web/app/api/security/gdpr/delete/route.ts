import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { gdpr } from "@/lib/security/gdpr-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const deleteSchema = z.object({
  userId: z.string().min(1).optional(),
  confirmation: z.literal("DELETE_USER_DATA"),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "data:delete",
    action: "gdpr.delete",
    resource: "api.security.gdpr.delete",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid delete request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = parsed.data.userId ?? context.user.id;
  const result = await gdpr.softDeleteUserData({
    organizationId: context.workspace.id,
    userId,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "gdpr.delete",
    resource: "user",
    resourceId: userId,
    request,
    metadata: { self: userId === context.user.id, deletedAt: result.deletedAt },
  });

  return NextResponse.json(result);
}
