"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Clock3, FileText, Play, RefreshCcw, Save, Workflow } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rag/ui";

type WorkflowActionType =
  | "SYNC_CONNECTOR"
  | "SYNC_ALL_CONNECTORS"
  | "INGEST_PENDING_DOCUMENTS"
  | "GENERATE_DOCUMENT_SUMMARIES";

type WorkflowRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actions: Array<{ type: WorkflowActionType; name?: string; config?: Record<string, unknown> }>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  runs: Array<{
    id: string;
    status: string;
    triggerType: string;
    errorMessage: string | null;
    createdAt: string;
    steps: Array<{ id: string; actionType: string; status: string; errorMessage: string | null }>;
  }>;
};

const actionLabels: Record<WorkflowActionType, string> = {
  SYNC_CONNECTOR: "Sync one connector",
  SYNC_ALL_CONNECTORS: "Sync due connectors",
  INGEST_PENDING_DOCUMENTS: "Ingest pending documents",
  GENERATE_DOCUMENT_SUMMARIES: "Generate AI summaries",
};

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

export function WorkflowsDashboard() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [queue, setQueue] = useState<Array<{ runId: string; state: string }>>([]);
  const [name, setName] = useState("Knowledge sync and summaries");
  const [description, setDescription] = useState(
    "Sync sources, ingest pending documents, and refresh AI summaries.",
  );
  const [status, setStatus] = useState("ACTIVE");
  const [triggerType, setTriggerType] = useState("SCHEDULE");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [connectorId, setConnectorId] = useState("");
  const [actionType, setActionType] = useState<WorkflowActionType>("SYNC_ALL_CONNECTORS");
  const [secondActionType, setSecondActionType] = useState<WorkflowActionType>(
    "INGEST_PENDING_DOCUMENTS",
  );
  const [thirdActionType, setThirdActionType] = useState<WorkflowActionType>(
    "GENERATE_DOCUMENT_SUMMARIES",
  );
  const [limit, setLimit] = useState("10");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.status === "ACTIVE").length,
    [workflows],
  );
  const failedRuns = useMemo(
    () =>
      workflows.flatMap((workflow) => workflow.runs).filter((run) => run.status === "FAILED")
        .length,
    [workflows],
  );

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);

    try {
      const [workflowResponse, queueResponse] = await Promise.all([
        fetch("/api/workflows", { cache: "no-store" }),
        fetch("/api/workflows/run", { cache: "no-store" }),
      ]);

      if (workflowResponse.ok) {
        const payload = (await workflowResponse.json()) as { workflows: WorkflowRecord[] };
        setWorkflows(payload.workflows);
      }

      if (queueResponse.ok) {
        const payload = (await queueResponse.json()) as {
          queue: Array<{ runId: string; state: string }>;
        };
        setQueue(payload.queue);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  function actionConfig(type: WorkflowActionType) {
    if (type === "SYNC_CONNECTOR") {
      return { connectorId };
    }

    if (type === "INGEST_PENDING_DOCUMENTS" || type === "GENERATE_DOCUMENT_SUMMARIES") {
      return { limit: Number(limit) };
    }

    return {};
  }

  async function createWorkflow() {
    setIsSaving(true);

    try {
      const actions = [actionType, secondActionType, thirdActionType].map((type) => ({
        type,
        name: actionLabels[type],
        config: actionConfig(type),
      }));
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          status,
          triggerType,
          triggerConfig:
            triggerType === "SCHEDULE"
              ? { intervalMinutes: Number(intervalMinutes) }
              : { connectorId },
          actions,
        }),
      });

      if (response.ok) {
        await loadWorkflows();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function runWorkflow(workflowId: string) {
    const response = await fetch("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, mode: "manual" }),
    });

    if (response.ok) {
      await loadWorkflows();
    }
  }

  async function queueScheduled() {
    const response = await fetch("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scheduled" }),
    });

    if (response.ok) {
      await loadWorkflows();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={queueScheduled}>
          <Clock3 />
          Queue scheduled
        </Button>
        <Button variant="outline" onClick={loadWorkflows}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Workflow} label="Workflows" value={String(workflows.length)} />
        <MetricCard icon={Play} label="Active" value={String(activeWorkflows)} />
        <MetricCard icon={Bot} label="Queued runs" value={String(queue.length)} />
        <MetricCard icon={FileText} label="Failed runs" value={String(failedRuns)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow builder</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="workflow-name">
              Name
            </label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <label className="text-sm font-medium" htmlFor="workflow-description">
              Description
            </label>
            <Input
              id="workflow-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={["ACTIVE", "DRAFT", "PAUSED"]}
          />
          <SelectField
            label="Trigger"
            value={triggerType}
            onChange={setTriggerType}
            options={["SCHEDULE", "MANUAL", "CONNECTOR_WEBHOOK", "DOCUMENT_CREATED"]}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="workflow-interval">
              Interval or connector ID
            </label>
            <Input
              id="workflow-interval"
              value={triggerType === "SCHEDULE" ? intervalMinutes : connectorId}
              onChange={(event) =>
                triggerType === "SCHEDULE"
                  ? setIntervalMinutes(event.target.value)
                  : setConnectorId(event.target.value)
              }
            />
          </div>
          <SelectField
            label="Action 1"
            value={actionType}
            onChange={(value) => setActionType(value as WorkflowActionType)}
            options={Object.keys(actionLabels)}
          />
          <SelectField
            label="Action 2"
            value={secondActionType}
            onChange={(value) => setSecondActionType(value as WorkflowActionType)}
            options={Object.keys(actionLabels)}
          />
          <SelectField
            label="Action 3"
            value={thirdActionType}
            onChange={(value) => setThirdActionType(value as WorkflowActionType)}
            options={Object.keys(actionLabels)}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="workflow-limit">
              Document limit
            </label>
            <Input
              id="workflow-limit"
              type="number"
              min={1}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <Button onClick={createWorkflow} disabled={isSaving}>
              <Save />
              Save workflow
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {workflows.length ? (
          workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{workflow.triggerType}</Badge>
                      <Badge variant={workflow.status === "ACTIVE" ? "default" : "outline"}>
                        {workflow.status}
                      </Badge>
                      <p className="font-semibold">{workflow.name}</p>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {workflow.description ?? "No description"} · Last run{" "}
                      {formatDate(workflow.lastRunAt)} · Next run {formatDate(workflow.nextRunAt)}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => runWorkflow(workflow.id)}>
                    <Play />
                    Run
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {workflow.actions.map((action, index) => (
                    <Badge key={`${workflow.id}-${index}`} variant="outline">
                      {actionLabels[action.type] ?? action.type}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  {workflow.runs.length ? (
                    workflow.runs.map((run) => (
                      <div
                        key={run.id}
                        className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={run.status === "FAILED" ? "destructive" : "outline"}>
                            {run.status}
                          </Badge>
                          <span className="text-sm font-medium">{run.triggerType}</span>
                          <span className="text-muted-foreground text-sm">
                            {run.steps.length} steps
                          </span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {formatDate(run.createdAt)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No workflow runs yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-muted-foreground p-4 text-sm">
              No workflows configured yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <select
        className="border-input bg-background h-10 rounded-md border px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Workflow;
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
