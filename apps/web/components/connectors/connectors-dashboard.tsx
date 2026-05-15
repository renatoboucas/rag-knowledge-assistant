"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cable, Clock3, GitBranch, RefreshCcw, Save, Webhook } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rag/ui";

type Provider = {
  provider: string;
  sourceType: string;
  displayName: string;
};

type Connector = {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  syncIntervalMin: number;
  lastSyncFinishedAt: string | null;
  lastWebhookAt: string | null;
  errorMessage: string | null;
  syncJobs: Array<{
    id: string;
    status: string;
    syncType: string;
    documentsSeen: number;
    documentsAdded: number;
    documentsUpdated: number;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

const providerDefaults: Record<
  string,
  { name: string; configLabel: string; credentialLabel: string }
> = {
  GOOGLE_DRIVE: {
    name: "Google Drive",
    configLabel: "Drive ID",
    credentialLabel: "OAuth access token",
  },
  NOTION: {
    name: "Notion",
    configLabel: "Database ID",
    credentialLabel: "Integration token",
  },
  CONFLUENCE: {
    name: "Confluence",
    configLabel: "Space key",
    credentialLabel: "API token",
  },
  SLACK: {
    name: "Slack",
    configLabel: "Channel ID",
    credentialLabel: "Bot token",
  },
  GITHUB: {
    name: "GitHub",
    configLabel: "owner/repository",
    credentialLabel: "Fine-grained token",
  },
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

export function ConnectorsDashboard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [provider, setProvider] = useState("GOOGLE_DRIVE");
  const [name, setName] = useState("Google Drive");
  const [configValue, setConfigValue] = useState("");
  const [credential, setCredential] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [syncIntervalMin, setSyncIntervalMin] = useState("60");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedProvider = useMemo(() => providerDefaults[provider], [provider]);

  const loadConnectors = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/connectors", { cache: "no-store" });

      if (response.ok) {
        const payload = (await response.json()) as {
          providers: Provider[];
          connectors: Connector[];
        };
        setProviders(payload.providers);
        setConnectors(payload.connectors);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  useEffect(() => {
    setName(providerDefaults[provider]?.name ?? provider);
  }, [provider]);

  function buildConfig() {
    if (provider === "GITHUB") {
      const [owner, repository] = configValue.split("/");
      return { owner, repository, syncIntervalMin: Number(syncIntervalMin) };
    }

    if (provider === "GOOGLE_DRIVE") {
      return { driveId: configValue, syncIntervalMin: Number(syncIntervalMin) };
    }

    if (provider === "NOTION") {
      return { databaseId: configValue, syncIntervalMin: Number(syncIntervalMin) };
    }

    if (provider === "CONFLUENCE") {
      return { spaceKey: configValue, syncIntervalMin: Number(syncIntervalMin) };
    }

    return { channelId: configValue, syncIntervalMin: Number(syncIntervalMin) };
  }

  function buildCredentials() {
    if (provider === "SLACK") {
      return { botToken: credential };
    }

    if (provider === "CONFLUENCE") {
      return { apiToken: credential, baseUrl };
    }

    if (provider === "GITHUB") {
      return { accessToken: credential };
    }

    return { accessToken: credential };
  }

  async function createConnector() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          name,
          config: buildConfig(),
          credentials: buildCredentials(),
          syncIntervalMin: Number(syncIntervalMin),
        }),
      });

      if (response.ok) {
        setCredential("");
        setConfigValue("");
        setBaseUrl("");
        await loadConnectors();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function syncConnector(connectorId: string) {
    const response = await fetch("/api/connectors/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, mode: "manual" }),
    });

    if (response.ok) {
      await loadConnectors();
    }
  }

  async function scheduleDueSyncs() {
    const response = await fetch("/api/connectors/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scheduled" }),
    });

    if (response.ok) {
      await loadConnectors();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={scheduleDueSyncs}>
          <Clock3 />
          Queue due syncs
        </Button>
        <Button variant="outline" onClick={loadConnectors}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cable} label="Connectors" value={String(connectors.length)} />
        <MetricCard
          icon={GitBranch}
          label="Enabled"
          value={String(connectors.filter((connector) => connector.isEnabled).length)}
        />
        <MetricCard
          icon={RefreshCcw}
          label="Syncing"
          value={String(connectors.filter((connector) => connector.status === "SYNCING").length)}
        />
        <MetricCard icon={Webhook} label="Webhook-ready" value={String(providers.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add connector</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="provider">
              Provider
            </label>
            <select
              id="provider"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              {providers.map((item) => (
                <option key={item.provider} value={item.provider}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="connector-name">
              Name
            </label>
            <Input
              id="connector-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="connector-config">
              {selectedProvider?.configLabel ?? "Config"}
            </label>
            <Input
              id="connector-config"
              value={configValue}
              onChange={(event) => setConfigValue(event.target.value)}
            />
          </div>
          {provider === "CONFLUENCE" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="base-url">
                Base URL
              </label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="connector-token">
              {selectedProvider?.credentialLabel ?? "Token"}
            </label>
            <Input
              id="connector-token"
              type="password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sync-interval">
              Sync interval
            </label>
            <Input
              id="sync-interval"
              min={5}
              type="number"
              value={syncIntervalMin}
              onChange={(event) => setSyncIntervalMin(event.target.value)}
            />
          </div>
          <div className="flex items-end xl:col-span-5">
            <Button onClick={createConnector} disabled={isSaving}>
              <Save />
              Save connector
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {connectors.length ? (
          connectors.map((connector) => (
            <Card key={connector.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{connector.provider}</Badge>
                      <Badge variant={connector.status === "ERROR" ? "destructive" : "outline"}>
                        {connector.status}
                      </Badge>
                      <p className="font-semibold">{connector.name}</p>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Every {connector.syncIntervalMin} minutes · Last sync{" "}
                      {formatDate(connector.lastSyncFinishedAt)} · Last webhook{" "}
                      {formatDate(connector.lastWebhookAt)}
                    </p>
                    {connector.errorMessage ? (
                      <p className="text-destructive mt-2 text-sm">{connector.errorMessage}</p>
                    ) : null}
                  </div>
                  <Button variant="outline" onClick={() => syncConnector(connector.id)}>
                    <RefreshCcw />
                    Sync now
                  </Button>
                </div>
                <div className="mt-4 grid gap-2">
                  {connector.syncJobs.length ? (
                    connector.syncJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={job.status === "FAILED" ? "destructive" : "outline"}>
                            {job.status}
                          </Badge>
                          <span className="text-sm font-medium">{job.syncType}</span>
                          <span className="text-muted-foreground text-sm">
                            {job.documentsSeen} seen · {job.documentsAdded} added ·{" "}
                            {job.documentsUpdated} updated
                          </span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {formatDate(job.createdAt)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No sync jobs yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-muted-foreground p-4 text-sm">
              No connectors configured yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cable;
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
