import { NextResponse } from "next/server";
import { z } from "zod";

import { usageMetering } from "@/lib/billing";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const usageSchema = z.object({
  metric: z.literal("ai_tokens"),
  quantity: z.coerce.number().int().positive(),
  idempotencyKey: z.string().min(8).max(200),
  source: z.string().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "billing:manage",
    action: "billing.usage.record",
    resource: "api.billing.usage",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = usageSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid usage payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const usage = await usageMetering.recordAiTokens({
    organizationId: context.workspace.id,
    quantity: parsed.data.quantity,
    idempotencyKey: parsed.data.idempotencyKey,
    source: parsed.data.source,
    metadata: parsed.data.metadata,
  });

  return NextResponse.json({ usage }, { status: 202 });
}
