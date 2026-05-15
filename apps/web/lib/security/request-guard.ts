import { NextResponse } from "next/server";
import type { Permission } from "@rag/types";

import { env } from "@/lib/env";
import { can } from "@/lib/rbac";
import type { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { contentModeration } from "@/lib/security/content-moderation-service";
import { promptInjection } from "@/lib/security/prompt-injection-service";
import { rateLimiter } from "@/lib/security/rate-limit-service";

type SessionContext = NonNullable<Awaited<ReturnType<typeof getSessionContext>>>;

function rateLimitKey(context: SessionContext, request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return context.user.id || ip || "anonymous";
}

export async function enforceApiSecurity(input: {
  request: Request;
  context: SessionContext;
  permission?: Permission;
  action: string;
  resource: string;
  rateLimit?: "default" | "ai";
  prompt?: string;
}) {
  const { request, context } = input;

  if (!context.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  if (input.permission && !can(context.workspace.role, input.permission)) {
    await auditLog.record({
      organizationId: context.workspace.id,
      userId: context.user.id,
      action: input.action,
      resource: input.resource,
      outcome: "blocked",
      request,
      metadata: { reason: "missing_permission", permission: input.permission },
    });

    return NextResponse.json({ message: "Missing required permission." }, { status: 403 });
  }

  if (input.rateLimit) {
    const decision = await rateLimiter.check({
      key: rateLimitKey(context, request),
      route: input.resource,
      organizationId: context.workspace.id,
      limit: input.rateLimit === "ai" ? env.AI_RATE_LIMIT_REQUESTS : env.RATE_LIMIT_REQUESTS,
    });

    if (!decision.allowed) {
      await auditLog.record({
        organizationId: context.workspace.id,
        userId: context.user.id,
        action: input.action,
        resource: input.resource,
        outcome: "blocked",
        request,
        metadata: { reason: "rate_limited", resetAt: decision.resetAt },
      });

      return NextResponse.json(
        { message: "Rate limit exceeded.", resetAt: decision.resetAt },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000)),
            ),
            "X-RateLimit-Limit": String(decision.limit),
            "X-RateLimit-Remaining": String(decision.remaining),
          },
        },
      );
    }
  }

  if (input.prompt) {
    const injection = promptInjection.evaluate(input.prompt);
    const moderation = contentModeration.moderate(input.prompt);

    if (!injection.safe || !moderation.allowed) {
      await auditLog.record({
        organizationId: context.workspace.id,
        userId: context.user.id,
        action: input.action,
        resource: input.resource,
        outcome: "blocked",
        request,
        metadata: {
          reason: "prompt_guard",
          injection,
          moderation,
        },
      });

      return NextResponse.json(
        {
          message: "Request blocked by security policy.",
          injection,
          moderation,
        },
        { status: 400 },
      );
    }
  }

  return null;
}
