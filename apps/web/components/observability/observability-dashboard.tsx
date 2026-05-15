"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  DollarSign,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

type MetricsPayload = {
  ai: {
    calls: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    averageLatencyMs: number;
    byProvider: Array<{ provider: string; count: number; cost: number; tokens: number }>;
  };
  retrieval: {
    calls: number;
    averageLatencyMs: number;
    averageSimilarity: number;
    tracedEvents: number;
  };
  usage: {
    messages: number;
    assistantMessages: number;
    agentRuns: number;
    toolExecutions: number;
    errors: number;
  };
  performance: {
    averageAiLatencyMs: number;
    averageRetrievalLatencyMs: number;
    errorRate: number;
  };
  knowledge: {
    documents: number;
    indexedDocuments: number;
    tokens: number;
  };
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

const emptyMetrics: MetricsPayload = {
  ai: {
    calls: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    averageLatencyMs: 0,
    byProvider: [],
  },
  retrieval: { calls: 0, averageLatencyMs: 0, averageSimilarity: 0, tracedEvents: 0 },
  usage: { messages: 0, assistantMessages: 0, agentRuns: 0, toolExecutions: 0, errors: 0 },
  performance: { averageAiLatencyMs: 0, averageRetrievalLatencyMs: 0, errorRate: 0 },
  knowledge: { documents: 0, indexedDocuments: 0, tokens: 0 },
  recentEvents: [],
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
    maximumFractionDigits: 4,
  }).format(value);
}

function formatMs(value: number | null) {
  return `${Math.round(value ?? 0)}ms`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<MetricsPayload>(emptyMetrics);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/observability/metrics", { cache: "no-store" });

      if (response.ok) {
        setMetrics((await response.json()) as MetricsPayload);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadMetrics}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Zap} label="AI calls" value={formatNumber(metrics.ai.calls)} />
        <MetricCard icon={BarChart3} label="Tokens" value={formatNumber(metrics.ai.totalTokens)} />
        <MetricCard
          icon={DollarSign}
          label="Estimated cost"
          value={formatCurrency(metrics.ai.estimatedCost)}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Error rate"
          value={`${(metrics.performance.errorRate * 100).toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>AI usage by provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.ai.byProvider.length ? (
              metrics.ai.byProvider.map((provider) => (
                <div key={provider.provider} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium capitalize">{provider.provider}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatNumber(provider.tokens)} tokens · {formatCurrency(provider.cost)}
                      </p>
                    </div>
                    <Badge variant="secondary">{provider.count} calls</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No AI calls captured yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow
              icon={Clock}
              label="Avg AI latency"
              value={formatMs(metrics.performance.averageAiLatencyMs)}
            />
            <MetricRow
              icon={Activity}
              label="Avg retrieval latency"
              value={formatMs(metrics.performance.averageRetrievalLatencyMs)}
            />
            <MetricRow
              icon={Database}
              label="Retrieval calls"
              value={formatNumber(metrics.retrieval.calls)}
            />
            <MetricRow
              icon={BarChart3}
              label="Avg similarity"
              value={metrics.retrieval.averageSimilarity.toFixed(3)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricPanel
          title="Usage metrics"
          rows={[
            ["Messages", metrics.usage.messages],
            ["Assistant messages", metrics.usage.assistantMessages],
            ["Agent runs", metrics.usage.agentRuns],
            ["Tool executions", metrics.usage.toolExecutions],
          ]}
        />
        <MetricPanel
          title="Knowledge metrics"
          rows={[
            ["Documents", metrics.knowledge.documents],
            ["Indexed documents", metrics.knowledge.indexedDocuments],
            ["Knowledge tokens", metrics.knowledge.tokens],
            ["Retrieval traces", metrics.retrieval.tracedEvents],
          ]}
        />
        <MetricPanel
          title="Token split"
          rows={[
            ["Input tokens", metrics.ai.inputTokens],
            ["Output tokens", metrics.ai.outputTokens],
            ["Total tokens", metrics.ai.totalTokens],
            ["Errors", metrics.usage.errors],
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent telemetry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {metrics.recentEvents.length ? (
            metrics.recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={event.level === "error" ? "destructive" : "outline"}>
                      {event.level}
                    </Badge>
                    <p className="font-medium">{event.name}</p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {event.category} · {event.provider ?? "internal"} · {event.model ?? "n/a"}
                  </p>
                </div>
                <div className="text-muted-foreground text-sm md:text-right">
                  <p>
                    {formatNumber(event.totalTokens)} tokens · {formatCurrency(event.estimatedCost)}
                  </p>
                  <p>
                    {formatMs(event.latencyMs)} · {formatDate(event.createdAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No telemetry events captured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
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
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" />
        {label}
      </div>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MetricPanel({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="font-medium tabular-nums">{formatNumber(value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
