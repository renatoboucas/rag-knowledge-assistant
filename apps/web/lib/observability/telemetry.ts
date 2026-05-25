import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { usageMetering } from "@/lib/billing/usage-metering-service";
import { getPostHogServerClient } from "@/lib/observability/posthog-server";
import type { CaptureEventInput } from "@/lib/observability/types";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class TelemetryService {
  async captureEvent(input: CaptureEventInput) {
    const usage = input.usage ?? {};
    const totalTokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

    await prisma.observabilityEvent
      .create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          category: input.category,
          name: input.name,
          level: input.level ?? "info",
          traceId: input.traceId,
          provider: input.provider,
          model: input.model,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens,
          estimatedCost: input.estimatedCost ?? 0,
          latencyMs: input.latencyMs,
          metadata: jsonValue(input.metadata),
        },
      })
      .catch((error: unknown) => {
        Sentry.captureException(error);
      });

    if (input.category === "ai" && input.organizationId && totalTokens > 0) {
      await usageMetering
        .recordAiTokens({
          organizationId: input.organizationId,
          quantity: totalTokens,
          idempotencyKey: `observability:${input.traceId ?? input.name}:${Date.now()}`,
          source: input.name,
          metadata: {
            provider: input.provider,
            model: input.model,
            traceId: input.traceId,
          },
        })
        .catch((error: unknown) => {
          Sentry.captureException(error);
        });
    }

    const posthog = getPostHogServerClient();

    if (posthog) {
      posthog.capture({
        distinctId: input.userId ?? input.organizationId ?? "anonymous-server",
        event: input.name,
        properties: {
          category: input.category,
          level: input.level ?? "info",
          organizationId: input.organizationId,
          traceId: input.traceId,
          provider: input.provider,
          model: input.model,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens,
          estimatedCost: input.estimatedCost ?? 0,
          latencyMs: input.latencyMs,
          ...(typeof input.metadata === "object" && input.metadata ? input.metadata : {}),
        },
      });
    }
  }

  async captureError(
    error: unknown,
    input: Omit<CaptureEventInput, "category" | "name"> & { name: string },
  ) {
    Sentry.captureException(error, {
      tags: {
        organizationId: input.organizationId,
        provider: input.provider,
        model: input.model,
      },
      extra: {
        traceId: input.traceId,
        metadata: input.metadata,
      },
    });

    await this.captureEvent({
      ...input,
      category: "error",
      level: "error",
      metadata: {
        ...(typeof input.metadata === "object" && input.metadata ? input.metadata : {}),
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export const telemetry = new TelemetryService();
