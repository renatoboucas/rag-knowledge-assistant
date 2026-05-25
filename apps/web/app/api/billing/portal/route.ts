import { NextResponse } from "next/server";

import { billingService } from "@/lib/billing";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

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
    action: "billing.portal.create",
    resource: "api.billing.portal",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  try {
    const session = await billingService.createPortalSession({
      organizationId: context.workspace.id,
      origin: requestOrigin(request),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create billing portal." },
      { status: 503 },
    );
  }
}
