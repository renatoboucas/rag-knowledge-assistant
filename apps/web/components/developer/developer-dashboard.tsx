"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Code2, KeyRound, Plus, RefreshCcw, Shield, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rag/ui";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  displayKey: string;
  scopes: string[];
  rateLimitPerMinute: number;
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type ApiRequestLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  createdAt: string;
  apiKey: { id: string; name: string; prefix: string } | null;
};

type DeveloperPayload = {
  keys: ApiKey[];
  recentLogs: ApiRequestLog[];
};

const emptyPayload: DeveloperPayload = { keys: [], recentLogs: [] };
const scopeOptions = ["documents:read", "retrieval:read", "chat:write", "evaluations:read"];

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

function docsUrl(path: string) {
  return path;
}

export function DeveloperDashboard() {
  const [payload, setPayload] = useState<DeveloperPayload>(emptyPayload);
  const [name, setName] = useState("Production integration");
  const [scopes, setScopes] = useState<string[]>(["documents:read", "retrieval:read"]);
  const [rateLimit, setRateLimit] = useState(60);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeKeys = useMemo(() => payload.keys.filter((key) => key.active).length, [payload.keys]);

  const loadDeveloperData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/developer/api-keys");

      if (!response.ok) {
        throw new Error("Unable to load developer platform data.");
      }

      setPayload((await response.json()) as DeveloperPayload);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load developer platform data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeveloperData();
  }, [loadDeveloperData]);

  const toggleScope = (scope: string) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  const createApiKey = async () => {
    setIsCreating(true);
    setNewSecret(null);
    setError(null);

    try {
      const response = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes, rateLimitPerMinute: rateLimit }),
      });

      if (!response.ok) {
        throw new Error("Unable to create API key.");
      }

      const created = (await response.json()) as { secret: string };
      setNewSecret(created.secret);
      await loadDeveloperData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create API key.");
    } finally {
      setIsCreating(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/developer/api-keys/${keyId}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Unable to revoke API key.");
      }

      await loadDeveloperData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke API key.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadDeveloperData}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {newSecret ? (
        <div className="border-primary/30 bg-primary/10 rounded-md border px-4 py-3">
          <p className="text-sm font-medium">New API key</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Store this key now. It will not be shown again.
          </p>
          <code className="bg-background mt-3 block overflow-x-auto rounded-md border px-3 py-2 text-sm">
            {newSecret}
          </code>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={KeyRound} label="Active keys" value={String(activeKeys)} />
        <MetricCard icon={Shield} label="Default limit" value="60/min" />
        <MetricCard icon={BookOpen} label="OpenAPI" value="3.1" />
        <MetricCard icon={Code2} label="SDK" value="TypeScript" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key-name">
                Name
              </label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key-rate-limit">
                Rate limit per minute
              </label>
              <Input
                id="api-key-rate-limit"
                type="number"
                min={10}
                max={1000}
                value={rateLimit}
                onChange={(event) => setRateLimit(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Scopes</p>
              <div className="flex flex-wrap gap-2">
                {scopeOptions.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => toggleScope(scope)}
                    className={
                      scopes.includes(scope)
                        ? "bg-primary text-primary-foreground rounded-md px-3 py-1 text-xs font-medium"
                        : "bg-muted text-muted-foreground rounded-md px-3 py-1 text-xs font-medium"
                    }
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={createApiKey} disabled={isCreating || !name.trim() || !scopes.length}>
              <Plus />
              {isCreating ? "Creating" : "Create key"}
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>API keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.keys.length ? (
              payload.keys.map((key) => (
                <div key={key.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={key.active ? "secondary" : "destructive"}>
                          {key.active ? "active" : "revoked"}
                        </Badge>
                        <p className="font-medium">{key.name}</p>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {key.displayKey} · {key.rateLimitPerMinute}/min · last used{" "}
                        {formatDate(key.lastUsedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!key.active}
                      onClick={() => void revokeApiKey(key.id)}
                    >
                      <Trash2 />
                      Revoke
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No API keys have been created yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DocLink href={docsUrl("/api/developer/openapi")} label="OpenAPI JSON" />
            <DocLink
              href={docsUrl("/api/developer/sdk/typescript")}
              label="TypeScript SDK source"
            />
            <code className="bg-muted block overflow-x-auto rounded-md px-3 py-2">
              Authorization: Bearer rka_...
            </code>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent API requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.recentLogs.length ? (
              payload.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status >= 400 ? "destructive" : "outline"}>
                        {log.status}
                      </Badge>
                      <p className="font-medium">
                        {log.method} {log.path}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {log.apiKey?.name ?? "Unknown key"} · {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm">{log.latencyMs}ms</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No public API requests captured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof KeyRound;
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

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="hover:bg-accent/10 flex items-center justify-between rounded-md border px-3 py-2 transition-colors"
    >
      <span>{label}</span>
      <BookOpen className="text-muted-foreground size-4" />
    </a>
  );
}
