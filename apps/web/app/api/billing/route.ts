import { NextResponse } from "next/server";

import { billingService } from "@/lib/billing";
import { getSessionContext } from "@/lib/session";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "billing:read",
    action: "billing.read",
    resource: "api.billing",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const billing = await billingService.getOverview(context.workspace.id);

  return NextResponse.json({ billing });
}
