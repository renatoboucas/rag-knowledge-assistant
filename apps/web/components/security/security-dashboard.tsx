"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileClock,
  RefreshCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rag/ui";

type AuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  outcome: string;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type GovernancePayload = {
  organization: {
    id: string;
    name: string;
    dataRegion: string;
    retentionDays: number;
    updatedAt: string;
  };
  policies: {
    promptInjectionProtection: boolean;
    contentModeration: boolean;
    defaultRateLimit: number;
    aiRateLimit: number;
    rateLimitWindowSeconds: number;
    defaultRetentionDays: number;
  };
};

type ExportSummary = {
  exportedAt: string;
  messages: unknown[];
  documents: unknown[];
  auditLogs: unknown[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function actorName(log: AuditLog) {
  if (!log.user) {
    return "System";
  }

  const name = [log.user.firstName, log.user.lastName].filter(Boolean).join(" ");
  return name || log.user.email;
}

export function SecurityDashboard() {
  const [governance, setGovernance] = useState<GovernancePayload | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [dataRegion, setDataRegion] = useState("us");
  const [retentionDays, setRetentionDays] = useState("365");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [gdprExport, setGdprExport] = useState<ExportSummary | null>(null);

  const loadSecurity = useCallback(async () => {
    setIsLoading(true);

    try {
      const [governanceResponse, logsResponse] = await Promise.all([
        fetch("/api/security/governance", { cache: "no-store" }),
        fetch("/api/security/audit-logs?limit=50", { cache: "no-store" }),
      ]);

      if (governanceResponse.ok) {
        const payload = (await governanceResponse.json()) as GovernancePayload;
        setGovernance(payload);
        setDataRegion(payload.organization.dataRegion);
        setRetentionDays(String(payload.organization.retentionDays));
      }

      if (logsResponse.ok) {
        const payload = (await logsResponse.json()) as { logs: AuditLog[] };
        setLogs(payload.logs);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const blockedEvents = useMemo(
    () => logs.filter((log) => log.outcome === "blocked").length,
    [logs],
  );

  async function saveGovernance() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/security/governance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataRegion,
          retentionDays: Number(retentionDays),
        }),
      });

      if (response.ok) {
        await loadSecurity();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function exportData() {
    const response = await fetch("/api/security/gdpr/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      setGdprExport((await response.json()) as ExportSummary);
      await loadSecurity();
    }
  }

  async function deleteData() {
    const response = await fetch("/api/security/gdpr/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE_USER_DATA" }),
    });

    if (response.ok) {
      await loadSecurity();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadSecurity}>
          <RefreshCcw className={isLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SecurityMetric icon={ShieldCheck} label="Audit events" value={String(logs.length)} />
        <SecurityMetric icon={FileClock} label="Blocked events" value={String(blockedEvents)} />
        <SecurityMetric
          icon={SlidersHorizontal}
          label="Default rate limit"
          value={`${governance?.policies.defaultRateLimit ?? 0}/min`}
        />
        <SecurityMetric
          icon={SlidersHorizontal}
          label="AI rate limit"
          value={`${governance?.policies.aiRateLimit ?? 0}/min`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Governance controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="data-region">
                Data region
              </label>
              <Input
                id="data-region"
                value={dataRegion}
                onChange={(event) => setDataRegion(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="retention-days">
                Retention days
              </label>
              <Input
                id="retention-days"
                min={30}
                type="number"
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <PolicyBadge
                active={Boolean(governance?.policies.promptInjectionProtection)}
                label="Prompt injection protection"
              />
              <PolicyBadge
                active={Boolean(governance?.policies.contentModeration)}
                label="Content moderation"
              />
              <PolicyBadge active label="Tenant isolation" />
              <PolicyBadge active label="Audit logging" />
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveGovernance} disabled={isSaving}>
                <Save />
                Save governance
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GDPR actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" onClick={exportData}>
              <Download />
              Export my data
            </Button>
            <Button className="w-full justify-start" variant="destructive" onClick={deleteData}>
              <Trash2 />
              Soft delete my data
            </Button>
            {gdprExport ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Latest export</p>
                <p className="text-muted-foreground mt-1">
                  {gdprExport.messages.length} messages, {gdprExport.documents.length} documents,{" "}
                  {gdprExport.auditLogs.length} audit records
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent audit log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={log.outcome === "blocked" ? "destructive" : "outline"}>
                      {log.outcome}
                    </Badge>
                    <p className="font-medium">{log.action}</p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {actorName(log)} · {log.resource}
                    {log.resourceId ? ` · ${log.resourceId}` : ""}
                  </p>
                </div>
                <div className="text-muted-foreground text-sm md:text-right">
                  <p>{log.ipAddress ?? "No IP captured"}</p>
                  <p>{formatDate(log.createdAt)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No audit events captured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
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

function PolicyBadge({ active, label }: { active: boolean; label: string }) {
  return <Badge variant={active ? "secondary" : "outline"}>{label}</Badge>;
}
