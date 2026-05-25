import { NextResponse } from "next/server";

import { apiKeyService, type ApiKeyScope, hasScope } from "@/lib/developer/api-key-service";
import { rateLimiter } from "@/lib/security/rate-limit-service";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length).trim();
}

export type PublicApiContext = NonNullable<Awaited<ReturnType<typeof apiKeyService.authenticate>>>;

export async function withPublicApi<T>(
  request: Request,
  input: { scope: ApiKeyScope; route: string },
  handler: (context: PublicApiContext) => Promise<NextResponse<T>>,
) {
  const startedAt = Date.now();
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }

  const context = await apiKeyService.authenticate(token);

  if (!context) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  if (!hasScope(context.scopes, input.scope)) {
    await apiKeyService.recordUsage({
      organizationId: context.organization.id,
      apiKeyId: context.key.id,
      method: request.method,
      path: new URL(request.url).pathname,
      status: 403,
      latencyMs: Date.now() - startedAt,
      request,
      metadata: { reason: "missing_scope", requiredScope: input.scope },
    });

    return NextResponse.json(
      { error: "missing_scope", requiredScope: input.scope },
      { status: 403 },
    );
  }

  const decision = await rateLimiter.check({
    key: `api-key:${context.key.id}`,
    route: input.route,
    organizationId: context.organization.id,
    limit: context.key.rateLimitPerMinute,
    windowSeconds: 60,
  });

  if (!decision.allowed) {
    await apiKeyService.recordUsage({
      organizationId: context.organization.id,
      apiKeyId: context.key.id,
      method: request.method,
      path: new URL(request.url).pathname,
      status: 429,
      latencyMs: Date.now() - startedAt,
      request,
      metadata: { reason: "rate_limited", resetAt: decision.resetAt },
    });

    return NextResponse.json(
      { error: "rate_limited", resetAt: decision.resetAt },
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

  try {
    const response = await handler(context);
    response.headers.set("X-RateLimit-Limit", String(decision.limit));
    response.headers.set("X-RateLimit-Remaining", String(decision.remaining));

    await apiKeyService.recordUsage({
      organizationId: context.organization.id,
      apiKeyId: context.key.id,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      request,
    });

    return response;
  } catch (error) {
    await apiKeyService.recordUsage({
      organizationId: context.organization.id,
      apiKeyId: context.key.id,
      method: request.method,
      path: new URL(request.url).pathname,
      status: 500,
      latencyMs: Date.now() - startedAt,
      request,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    throw error;
  }
}
