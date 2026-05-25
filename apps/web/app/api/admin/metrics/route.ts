import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { billingService } from "@/lib/billing";
import { env } from "@/lib/env";
import { cacheKey, getOrSetCache, privateCacheHeaders } from "@/lib/performance/cache";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

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

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "settings:read",
    action: "admin.metrics.read",
    resource: "api.admin.metrics",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);
  const since = sinceDate(Number.isFinite(days) ? days : 30);
  const organizationId = context.workspace.id;

  const payload = await getOrSetCache(
    cacheKey(["admin-metrics", organizationId, Number.isFinite(days) ? days : 30]),
    env.ANALYTICS_CACHE_SECONDS,
    async () => {
      const [
        organization,
        memberships,
        documents,
        conversations,
        messages,
        events,
        retrievalLogs,
        connectors,
        workflows,
        billing,
      ] = await Promise.all([
        prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            dataRegion: true,
            retentionDays: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.membership.findMany({
          where: { organizationId },
          select: {
            id: true,
            role: true,
            clerkRole: true,
            status: true,
            invitedEmail: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 250,
        }),
        prisma.document.findMany({
          where: { organizationId, deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            sourceType: true,
            tokenCount: true,
            chunkCount: true,
            updatedAt: true,
            createdAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 500,
        }),
        prisma.conversation.findMany({
          where: { organizationId, deletedAt: null, createdAt: { gte: since } },
          select: { id: true, status: true, createdAt: true },
          take: 500,
        }),
        prisma.message.findMany({
          where: { organizationId, deletedAt: null, createdAt: { gte: since } },
          select: { id: true, role: true, userId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
        prisma.observabilityEvent.findMany({
          where: { organizationId, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
        prisma.retrievalLog.findMany({
          where: { organizationId, deletedAt: null, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
        prisma.connector.findMany({
          where: { organizationId, deletedAt: null },
          select: { id: true, name: true, provider: true, status: true, lastSyncFinishedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
        prisma.workflow.findMany({
          where: { organizationId, deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            triggerType: true,
            lastRunStatus: true,
            lastRunAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
        billingService.getOverview(organizationId),
      ]);

      const aiEvents = events.filter((event) => event.category === "ai");
      const errorEvents = events.filter(
        (event) => event.level === "error" || event.category === "error",
      );
      const dailyUsage = new Map<
        string,
        { date: string; messages: number; tokens: number; cost: number }
      >();

      for (let index = Number.isFinite(days) ? days - 1 : 29; index >= 0; index -= 1) {
        const date = sinceDate(index);
        const key = dayKey(date);
        dailyUsage.set(key, { date: key, messages: 0, tokens: 0, cost: 0 });
      }

      for (const message of messages) {
        const day = dailyUsage.get(dayKey(message.createdAt));
        if (day) {
          day.messages += 1;
        }
      }

      for (const event of aiEvents) {
        const day = dailyUsage.get(dayKey(event.createdAt));
        if (day) {
          day.tokens += event.totalTokens;
          day.cost += event.estimatedCost;
        }
      }

      const providerMap = new Map<
        string,
        { provider: string; calls: number; tokens: number; cost: number; latency: number[] }
      >();

      for (const event of aiEvents) {
        const provider = event.provider ?? "internal";
        const current = providerMap.get(provider) ?? {
          provider,
          calls: 0,
          tokens: 0,
          cost: 0,
          latency: [],
        };
        current.calls += 1;
        current.tokens += event.totalTokens;
        current.cost += event.estimatedCost;
        if (typeof event.latencyMs === "number") {
          current.latency.push(event.latencyMs);
        }
        providerMap.set(provider, current);
      }

      return {
        range: { days, since },
        organization,
        users: {
          total: memberships.length,
          active: memberships.filter((membership) => membership.status === "ACTIVE").length,
          invited: memberships.filter((membership) => membership.status === "INVITED").length,
          suspended: memberships.filter((membership) => membership.status === "SUSPENDED").length,
          byRole: ["OWNER", "ADMIN", "MEMBER", "VIEWER"].map((role) => ({
            role,
            count: memberships.filter((membership) => membership.role === role).length,
          })),
          members: memberships.map((membership) => ({
            id: membership.id,
            role: membership.role,
            clerkRole: membership.clerkRole,
            status: membership.status,
            invitedEmail: membership.invitedEmail,
            createdAt: membership.createdAt,
            user: membership.user
              ? {
                  id: membership.user.id,
                  email: membership.user.email,
                  firstName: membership.user.firstName,
                  lastName: membership.user.lastName,
                  imageUrl: membership.user.imageUrl,
                  updatedAt: membership.user.updatedAt,
                }
              : null,
          })),
        },
        workspace: {
          documents: documents.length,
          indexedDocuments: documents.filter((document) => document.status === "INDEXED").length,
          tokens: documents.reduce((total, document) => total + document.tokenCount, 0),
          chunks: documents.reduce((total, document) => total + document.chunkCount, 0),
          conversations: conversations.length,
          connectors,
          workflows,
          recentDocuments: documents.slice(0, 10),
        },
        usage: {
          messages: messages.length,
          assistantMessages: messages.filter((message) => message.role === "ASSISTANT").length,
          daily: [...dailyUsage.values()],
          retrievals: retrievalLogs.length,
          averageRetrievalLatencyMs: average(retrievalLogs.map((log) => log.latencyMs)),
          averageSimilarity: average(retrievalLogs.map((log) => log.similarity)),
        },
        ai: {
          calls: aiEvents.length,
          tokens: aiEvents.reduce((total, event) => total + event.totalTokens, 0),
          inputTokens: aiEvents.reduce((total, event) => total + event.inputTokens, 0),
          outputTokens: aiEvents.reduce((total, event) => total + event.outputTokens, 0),
          estimatedCost: aiEvents.reduce((total, event) => total + event.estimatedCost, 0),
          averageLatencyMs: average(aiEvents.map((event) => event.latencyMs)),
          errorRate: events.length ? errorEvents.length / events.length : 0,
          byProvider: [...providerMap.values()].map((provider) => ({
            provider: provider.provider,
            calls: provider.calls,
            tokens: provider.tokens,
            cost: provider.cost,
            averageLatencyMs: average(provider.latency),
          })),
          recentEvents: events.slice(0, 20).map((event) => ({
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
        },
        billing: {
          plan: billing.plan.name,
          seats: memberships.length,
          seatUnitPrice: billing.plan.monthlyPriceCents / 100 / Math.max(memberships.length, 1),
          baseSubscription: billing.plan.monthlyPriceCents / 100,
          usageCharge: billing.usage.estimatedTokenOverageCents / 100,
          estimatedMonthlyTotal:
            (billing.plan.monthlyPriceCents + billing.usage.estimatedTokenOverageCents) / 100,
          includedTokens: billing.usage.includedTokens,
          billableTokens: billing.usage.billableTokens,
        },
      };
    },
  );

  await auditLog.record({
    organizationId,
    userId: context.user.id,
    action: "admin.metrics.read",
    resource: "admin_dashboard",
    request,
    metadata: { days },
  });

  return NextResponse.json(payload, { headers: privateCacheHeaders(env.ANALYTICS_CACHE_SECONDS) });
}
