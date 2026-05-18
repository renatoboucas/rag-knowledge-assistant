"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CreditCard,
  Database,
  DollarSign,
  RefreshCcw,
  Users,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

type AdminPayload = {
  organization: {
    name: string;
    slug: string | null;
    dataRegion: string;
    retentionDays: number;
    createdAt: string;
  };
  users: {
    total: number;
    active: number;
    invited: number;
    suspended: number;
    byRole: Array<{ role: string; count: number }>;
    members: Array<{
      id: string;
      role: string;
      status: string;
      clerkRole: string;
      invitedEmail: string | null;
      createdAt: string;
      user: {
        email: string;
        firstName: string | null;
        lastName: string | null;
        updatedAt: string;
      } | null;
    }>;
  };
  workspace: {
    documents: number;
    indexedDocuments: number;
    tokens: number;
    chunks: number;
    conversations: number;
    connectors: Array<{
      id: string;
      name: string;
      provider: string;
      status: string;
      lastSyncFinishedAt: string | null;
    }>;
    workflows: Array<{
      id: string;
      name: string;
      status: string;
      triggerType: string;
      lastRunStatus: string | null;
      lastRunAt: string | null;
    }>;
    recentDocuments: Array<{
      id: string;
      title: string;
      status: string;
      sourceType: string;
      tokenCount: number;
      updatedAt: string;
    }>;
  };
  usage: {
    messages: number;
    assistantMessages: number;
    retrievals: number;
    averageRetrievalLatencyMs: number;
    averageSimilarity: number;
    daily: Array<{ date: string; messages: number; tokens: number; cost: number }>;
  };
  ai: {
    calls: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    averageLatencyMs: number;
    errorRate: number;
    byProvider: Array<{
      provider: string;
      calls: number;
      tokens: number;
      cost: number;
      averageLatencyMs: number;
    }>;
    recentEvents: Array<{
      id: string;
      category: string;
      name: string;
      level: string;
      provider: string | null;
      model: string | null;
      totalTokens: number;
      estimatedCost: number;
      latencyMs: number | null;
      createdAt: string;
    }>;
  };
  billing: {
    plan: string;
    seats: number;
    seatUnitPrice: number;
    baseSubscription: number;
    usageCharge: number;
    estimatedMonthlyTotal: number;
    includedTokens: number;
    billableTokens: number;
  };
};

const emptyPayload: AdminPayload = {
  organization: {
    name: "Workspace",
    slug: null,
    dataRegion: "us",
    retentionDays: 365,
    createdAt: new Date().toISOString(),
  },
  users: { total: 0, active: 0, invited: 0, suspended: 0, byRole: [], members: [] },
  workspace: {
    documents: 0,
    indexedDocuments: 0,
    tokens: 0,
    chunks: 0,
    conversations: 0,
    connectors: [],
    workflows: [],
    recentDocuments: [],
  },
  usage: {
    messages: 0,
    assistantMessages: 0,
    retrievals: 0,
    averageRetrievalLatencyMs: 0,
    averageSimilarity: 0,
    daily: [],
  },
  ai: {
    calls: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    averageLatencyMs: 0,
    errorRate: 0,
    byProvider: [],
    recentEvents: [],
  },
  billing: {
    plan: "Team",
    seats: 0,
    seatUnitPrice: 0,
    baseSubscription: 0,
    usageCharge: 0,
    estimatedMonthlyTotal: 0,
    includedTokens: 0,
    billableTokens: 0,
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function maxDaily(payload: AdminPayload) {
  return Math.max(
    1,
    ...payload.usage.daily.map((day) => Math.max(day.messages, Math.ceil(day.tokens / 1000))),
  );
}

export function AdminDashboard() {
  const [payload, setPayload] = useState<AdminPayload>(emptyPayload);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/metrics?days=30", { cache: "no-store" });

      if (response.ok) {
        setPayload((await response.json()) as AdminPayload);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const maxChartValue = useMemo(() => maxDaily(payload), [payload]);

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadMetrics}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Users} label="Users" value={formatNumber(payload.users.total)} />
        <MetricCard
          icon={Database}
          label="Documents"
          value={formatNumber(payload.workspace.documents)}
        />
        <MetricCard icon={Bot} label="AI calls" value={formatNumber(payload.ai.calls)} />
        <MetricCard icon={BarChart3} label="Tokens" value={formatNumber(payload.ai.tokens)} />
        <MetricCard
          icon={DollarSign}
          label="Monthly est."
          value={formatCurrency(payload.billing.estimatedMonthlyTotal)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Usage analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-1 rounded-md border p-3">
              {payload.usage.daily.map((day) => {
                const messagesHeight = Math.max(4, (day.messages / maxChartValue) * 100);
                const tokenHeight = Math.max(
                  4,
                  (Math.ceil(day.tokens / 1000) / maxChartValue) * 100,
                );
                return (
                  <div key={day.date} className="flex min-w-0 flex-1 items-end gap-1">
                    <div
                      className="bg-primary/80 w-full rounded-t-sm"
                      style={{ height: `${messagesHeight}%` }}
                      title={`${day.date}: ${day.messages} messages`}
                    />
                    <div
                      className="bg-foreground/30 w-full rounded-t-sm"
                      style={{ height: `${tokenHeight}%` }}
                      title={`${day.date}: ${formatNumber(day.tokens)} tokens`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="text-muted-foreground mt-3 flex gap-4 text-sm">
              <span>Primary: messages</span>
              <span>Secondary: token thousands</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow icon={Building2} label="Workspace" value={payload.organization.name} />
            <MetricRow icon={Activity} label="Region" value={payload.organization.dataRegion} />
            <MetricRow
              icon={Database}
              label="Indexed"
              value={`${payload.workspace.indexedDocuments}/${payload.workspace.documents}`}
            />
            <MetricRow
              icon={BarChart3}
              label="Retrieval quality"
              value={payload.usage.averageSimilarity.toFixed(3)}
            />
            <MetricRow
              icon={ClockIcon}
              label="Retention"
              value={`${payload.organization.retentionDays} days`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Billing metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow icon={CreditCard} label="Plan" value={payload.billing.plan} />
            <MetricRow icon={Users} label="Seats" value={String(payload.billing.seats)} />
            <MetricRow
              icon={DollarSign}
              label="Base"
              value={formatCurrency(payload.billing.baseSubscription)}
            />
            <MetricRow
              icon={BarChart3}
              label="Overage"
              value={formatCurrency(payload.billing.usageCharge)}
            />
            <MetricRow
              icon={DollarSign}
              label="Estimated total"
              value={formatCurrency(payload.billing.estimatedMonthlyTotal)}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>AI monitoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat
                label="Avg latency"
                value={`${Math.round(payload.ai.averageLatencyMs)}ms`}
              />
              <MiniStat label="Error rate" value={`${(payload.ai.errorRate * 100).toFixed(1)}%`} />
              <MiniStat label="AI spend" value={formatCurrency(payload.ai.estimatedCost)} />
            </div>
            {payload.ai.byProvider.length ? (
              payload.ai.byProvider.map((provider) => (
                <div key={provider.provider} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium capitalize">{provider.provider}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatNumber(provider.tokens)} tokens · {formatCurrency(provider.cost)}
                      </p>
                    </div>
                    <Badge variant="secondary">{provider.calls} calls</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No AI usage captured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="User management"
          rows={payload.users.members.map((member) => ({
            id: member.id,
            primary: member.user?.email ?? member.invitedEmail ?? "Pending member",
            secondary: member.clerkRole,
            badge: member.status,
            meta: member.role,
          }))}
        />
        <DataTable
          title="Workspace automation"
          rows={[
            ...payload.workspace.connectors.map((connector) => ({
              id: connector.id,
              primary: connector.name,
              secondary: connector.provider,
              badge: connector.status,
              meta: `Last sync ${formatDate(connector.lastSyncFinishedAt)}`,
            })),
            ...payload.workspace.workflows.map((workflow) => ({
              id: workflow.id,
              primary: workflow.name,
              secondary: workflow.triggerType,
              badge: workflow.status,
              meta: `Last run ${formatDate(workflow.lastRunAt)}`,
            })),
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Recent documents"
          rows={payload.workspace.recentDocuments.map((document) => ({
            id: document.id,
            primary: document.title,
            secondary: document.sourceType,
            badge: document.status,
            meta: `${formatNumber(document.tokenCount)} tokens · ${formatDate(document.updatedAt)}`,
          }))}
        />
        <DataTable
          title="Recent AI events"
          rows={payload.ai.recentEvents.map((event) => ({
            id: event.id,
            primary: event.name,
            secondary: event.provider ?? event.category,
            badge: event.level,
            meta: `${formatNumber(event.totalTokens)} tokens · ${formatDate(event.createdAt)}`,
          }))}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" />
        {label}
      </div>
      <span className="max-w-44 truncate text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DataTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string; badge: string; meta: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.primary}</p>
                <p className="text-muted-foreground truncate text-sm">{row.secondary}</p>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className="text-muted-foreground text-sm">{row.meta}</span>
                <Badge
                  variant={
                    row.badge === "FAILED" || row.badge === "ERROR" ? "destructive" : "outline"
                  }
                >
                  {row.badge}
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No records available.</p>
        )}
      </CardContent>
    </Card>
  );
}

const ClockIcon = Activity;
