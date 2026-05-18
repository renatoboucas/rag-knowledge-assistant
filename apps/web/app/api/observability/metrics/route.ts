import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { cacheKey, getOrSetCache, privateCacheHeaders } from "@/lib/performance/cache";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getSessionContext } from "@/lib/session";

export const runtime = "nodejs";

function sinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : 0;
}

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  if (!can(context.workspace.role, "settings:read")) {
    return NextResponse.json({ message: "Missing required permission." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const since = sinceDate(Number.isFinite(days) ? days : 7);
  const organizationId = context.workspace.id;

  const payload = await getOrSetCache(
    cacheKey(["observability-metrics", organizationId, Number.isFinite(days) ? days : 7]),
    env.ANALYTICS_CACHE_SECONDS,
    async () => {
      const [events, retrievalLogs, messages, documents] = await Promise.all([
        prisma.observabilityEvent.findMany({
          where: {
            organizationId,
            createdAt: { gte: since },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        prisma.retrievalLog.findMany({
          where: {
            organizationId,
            createdAt: { gte: since },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        prisma.message.findMany({
          where: {
            organizationId,
            createdAt: { gte: since },
            deletedAt: null,
          },
          select: { role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        prisma.document.findMany({
          where: {
            organizationId,
            deletedAt: null,
          },
          select: { status: true, tokenCount: true },
        }),
      ]);

      const aiEvents = events.filter((event) => event.category === "ai");
      const errorEvents = events.filter(
        (event) => event.level === "error" || event.category === "error",
      );
      const agentEvents = events.filter((event) => event.category === "agent");
      const toolEvents = events.filter((event) => event.category === "tool");
      const retrievalEvents = events.filter((event) => event.category === "retrieval");

      const eventsByProvider = new Map<string, { count: number; cost: number; tokens: number }>();

      for (const event of aiEvents) {
        const key = event.provider ?? "unknown";
        const current = eventsByProvider.get(key) ?? { count: 0, cost: 0, tokens: 0 };
        current.count += 1;
        current.cost += event.estimatedCost;
        current.tokens += event.totalTokens;
        eventsByProvider.set(key, current);
      }

      return {
        range: { days, since },
        ai: {
          calls: aiEvents.length,
          totalTokens: aiEvents.reduce((total, event) => total + event.totalTokens, 0),
          inputTokens: aiEvents.reduce((total, event) => total + event.inputTokens, 0),
          outputTokens: aiEvents.reduce((total, event) => total + event.outputTokens, 0),
          estimatedCost: aiEvents.reduce((total, event) => total + event.estimatedCost, 0),
          averageLatencyMs: average(aiEvents.map((event) => event.latencyMs)),
          byProvider: [...eventsByProvider.entries()].map(([provider, value]) => ({
            provider,
            ...value,
          })),
        },
        retrieval: {
          calls: retrievalLogs.length,
          averageLatencyMs: average(retrievalLogs.map((log) => log.latencyMs)),
          averageSimilarity: average(retrievalLogs.map((log) => log.similarity)),
          tracedEvents: retrievalEvents.length,
        },
        usage: {
          messages: messages.length,
          assistantMessages: messages.filter((message) => message.role === "ASSISTANT").length,
          agentRuns: agentEvents.filter((event) => event.name === "agent.completed").length,
          toolExecutions: toolEvents.length,
          errors: errorEvents.length,
        },
        performance: {
          averageAiLatencyMs: average(aiEvents.map((event) => event.latencyMs)),
          averageRetrievalLatencyMs: average(retrievalLogs.map((log) => log.latencyMs)),
          errorRate: events.length ? errorEvents.length / events.length : 0,
        },
        knowledge: {
          documents: documents.length,
          indexedDocuments: documents.filter((document) => document.status === "INDEXED").length,
          tokens: documents.reduce((total, document) => total + document.tokenCount, 0),
        },
        recentEvents: events.slice(0, 25).map((event) => ({
          id: event.id,
          category: event.category,
          name: event.name,
          level: event.level,
          provider: event.provider,
          model: event.model,
          totalTokens: event.totalTokens,
          estimatedCost: event.estimatedCost,
          latencyMs: event.latencyMs,
          createdAt: event.createdAt,
        })),
      };
    },
  );

  return NextResponse.json(payload, { headers: privateCacheHeaders(env.ANALYTICS_CACHE_SECONDS) });
}
