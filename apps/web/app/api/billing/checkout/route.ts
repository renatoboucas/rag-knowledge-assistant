import { NextResponse } from "next/server";
import { z } from "zod";

import { billingService } from "@/lib/billing";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "enterprise"]),
});

function requestOrigin(request: Request) {
  return request.headers.get("origin") ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "billing:manage",
    action: "billing.checkout.create",
    resource: "api.billing.checkout",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid checkout payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await billingService.createCheckoutSession({
      organizationId: context.workspace.id,
      userEmail: context.user.email,
      plan: parsed.data.plan,
      origin: requestOrigin(request),
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create checkout session." },
      { status: 503 },
    );
  }
}
