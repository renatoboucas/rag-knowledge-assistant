import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { gdpr } from "@/lib/security/gdpr-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const exportSchema = z.object({
  userId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "data:export",
    action: "gdpr.export",
    resource: "api.security.gdpr.export",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = exportSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid export request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = parsed.data.userId ?? context.user.id;
  const data = await gdpr.exportUserData({
    organizationId: context.workspace.id,
    userId,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "gdpr.export",
    resource: "user",
    resourceId: userId,
    request,
    metadata: {
      self: userId === context.user.id,
      messageCount: data.messages.length,
      documentCount: data.documents.length,
    },
  });

  return NextResponse.json(data);
}
