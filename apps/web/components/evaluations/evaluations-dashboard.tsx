"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Database,
  FilePlus2,
  Gauge,
  Play,
  RefreshCcw,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

type EvaluationDataset = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  cases: Array<{ id: string; query: string }>;
};

type EvaluationResult = {
  id: string;
  query: string;
  overallScore: number;
  retrievalScore: number;
  hallucinationScore: number;
  responseQualityScore: number;
  risk: string;
  issues: unknown;
};

type EvaluationRun = {
  id: string;
  name: string;
  status: string;
  retrievalMode: string;
  aggregateScores: unknown;
  createdAt: string;
  completedAt: string | null;
  dataset: { id: string; name: string };
  results: EvaluationResult[];
};

const starterCases = [
  {
    query: "What security controls protect tenant data?",
    expectedAnswer:
      "Tenant data is protected with RBAC, audit logs, rate limiting, prompt injection protection, moderation, and data isolation.",
    requiredKeywords: ["RBAC", "audit", "tenant", "data isolation"],
  },
  {
    query: "How are document chunks and citations used in retrieval?",
    expectedAnswer:
      "Documents are split into chunks, embedded, retrieved with metadata, and returned with citation identifiers.",
    requiredKeywords: ["chunks", "embedded", "retrieved", "citations"],
  },
  {
    query: "How should the assistant respond when retrieved context is insufficient?",
    expectedAnswer:
      "The assistant should acknowledge insufficient context, avoid unsupported claims, and cite only retrieved evidence.",
    requiredKeywords: ["insufficient", "unsupported", "cite"],
  },
];

function scoreFrom(value: unknown, key: string) {
  if (value && typeof value === "object" && key in value) {
    const score = (value as Record<string, unknown>)[key];
    return typeof score === "number" ? score : 0;
  }

  return 0;
}

function countFrom(value: unknown, key: string) {
  return Math.round(scoreFrom(value, key));
}

function formatScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function issuesFrom(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function EvaluationsDashboard() {
  const [datasets, setDatasets] = useState<EvaluationDataset[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestRun = runs[0];

  const loadEvaluations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [datasetsResponse, runsResponse] = await Promise.all([
        fetch("/api/evaluations/datasets"),
        fetch("/api/evaluations/runs"),
      ]);

      if (!datasetsResponse.ok || !runsResponse.ok) {
        throw new Error("Unable to load evaluation data.");
      }

      const datasetsPayload = (await datasetsResponse.json()) as { datasets: EvaluationDataset[] };
      const runsPayload = (await runsResponse.json()) as { runs: EvaluationRun[] };
      setDatasets(datasetsPayload.datasets);
      setRuns(runsPayload.runs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load evaluation data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvaluations();
  }, [loadEvaluations]);

  const selectedDataset = useMemo(() => datasets[0], [datasets]);
  const latestScores = latestRun?.aggregateScores;
  const issueCount = useMemo(
    () =>
      runs
        .flatMap((run) => run.results)
        .reduce((total, result) => total + issuesFrom(result.issues).length, 0),
    [runs],
  );

  const createStarterDataset = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/evaluations/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Starter RAG Quality Benchmark",
          description:
            "Baseline checks for retrieval grounding, hallucination risk, and answer quality.",
          metadata: { source: "starter" },
          cases: starterCases,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create benchmark dataset.");
      }

      await loadEvaluations();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Unable to create benchmark dataset.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const runBenchmark = async () => {
    if (!selectedDataset) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/evaluations/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDataset.id, retrievalMode: "hybrid" }),
      });

      if (!response.ok) {
        throw new Error(
          "Unable to run benchmark. Confirm embeddings and database access are configured.",
        );
      }

      await loadEvaluations();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run benchmark.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={loadEvaluations}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
        <Button variant="outline" onClick={createStarterDataset} disabled={isCreating}>
          <FilePlus2 />
          {isCreating ? "Creating" : "Create starter benchmark"}
        </Button>
        <Button onClick={runBenchmark} disabled={!selectedDataset || isRunning}>
          <Play />
          {isRunning ? "Running" : "Run benchmark"}
        </Button>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Gauge}
          label="Overall quality"
          value={formatScore(scoreFrom(latestScores, "overallScore"))}
        />
        <MetricCard
          icon={Database}
          label="Retrieval"
          value={formatScore(scoreFrom(latestScores, "retrievalScore"))}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Hallucination guard"
          value={formatScore(scoreFrom(latestScores, "hallucinationScore"))}
        />
        <MetricCard icon={BarChart3} label="Open issues" value={String(issueCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Benchmark datasets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {datasets.length ? (
              datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{dataset.name}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {dataset.description ?? "No description"} · {dataset.cases.length} cases
                    </p>
                  </div>
                  <Badge variant="secondary">Updated {formatDate(dataset.updatedAt)}</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No benchmark datasets yet. Create the starter benchmark to establish a baseline.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestRun ? (
              <>
                <div>
                  <p className="font-medium">{latestRun.name}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {latestRun.dataset.name} · {latestRun.retrievalMode}
                  </p>
                </div>
                <MetricRow label="Status" value={latestRun.status} />
                <MetricRow label="Cases" value={String(countFrom(latestScores, "cases"))} />
                <MetricRow label="High risk" value={String(countFrom(latestScores, "highRisk"))} />
                <MetricRow label="Completed" value={formatDate(latestRun.completedAt)} />
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No evaluation runs have been captured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length ? (
            runs.map((run) => (
              <div key={run.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={run.status === "FAILED" ? "destructive" : "outline"}>
                        {run.status}
                      </Badge>
                      <p className="font-medium">{run.name}</p>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {run.dataset.name} · {formatDate(run.createdAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right text-sm">
                    <ScorePill
                      label="Retrieval"
                      value={scoreFrom(run.aggregateScores, "retrievalScore")}
                    />
                    <ScorePill
                      label="Grounding"
                      value={scoreFrom(run.aggregateScores, "hallucinationScore")}
                    />
                    <ScorePill
                      label="Quality"
                      value={scoreFrom(run.aggregateScores, "responseQualityScore")}
                    />
                  </div>
                </div>
                {run.results.length ? (
                  <div className="mt-3 grid gap-2">
                    {run.results.map((result) => (
                      <div key={result.id} className="bg-muted/30 rounded-md px-3 py-2 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium">{result.query}</span>
                          <Badge variant={result.risk === "high" ? "destructive" : "secondary"}>
                            {result.risk} · {formatScore(result.overallScore)}
                          </Badge>
                        </div>
                        {issuesFrom(result.issues).length ? (
                          <p className="text-muted-foreground mt-1">
                            {issuesFrom(result.issues).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              Run a benchmark to capture retrieval and response quality trends.
            </p>
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
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{formatScore(value)}</p>
    </div>
  );
}
