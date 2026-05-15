"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Database,
  FileText,
  Grid2X2,
  List,
  Pencil,
  RefreshCcw,
  Search,
  Tags,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  cn,
} from "@rag/ui";

type DocumentStatus = "PENDING" | "PROCESSING" | "INDEXED" | "FAILED" | "ARCHIVED";

type KnowledgeDocument = {
  id: string;
  title: string;
  status: DocumentStatus;
  sourceType: string;
  sourceUri: string | null;
  mimeType: string | null;
  chunkCount: number;
  tokenCount: number;
  errorMessage: string | null;
  tags: string[];
  collection: string | null;
  size?: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  retrievalCount: number;
  lastRetrievedAt: string | null;
};

type KnowledgePayload = {
  documents: KnowledgeDocument[];
  analytics: {
    total: number;
    indexed: number;
    processing: number;
    failed: number;
    archived: number;
    retrievals: number;
    tokens: number;
  };
  facets: {
    tags: Array<{ name: string; count: number }>;
    collections: Array<{ name: string; count: number }>;
  };
};

type ViewMode = "table" | "grid";

const emptyPayload: KnowledgePayload = {
  documents: [],
  analytics: {
    total: 0,
    indexed: 0,
    processing: 0,
    failed: 0,
    archived: 0,
    retrievals: 0,
    tokens: 0,
  },
  facets: { tags: [], collections: [] },
};

function statusVariant(status: DocumentStatus) {
  if (status === "INDEXED") {
    return "secondary";
  }

  if (status === "FAILED") {
    return "destructive";
  }

  return "outline";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
  }).format(value);
}

function formatBytes(bytes?: number) {
  if (!bytes) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
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

function customMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const custom = (metadata as { custom?: unknown }).custom;
  return custom && typeof custom === "object" && !Array.isArray(custom) ? custom : {};
}

function tagsInput(tags: string[]) {
  return tags.join(", ");
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function KnowledgeBaseDashboard() {
  const [payload, setPayload] = useState<KnowledgePayload>(emptyPayload);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [collection, setCollection] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [form, setForm] = useState({
    title: "",
    tags: "",
    collection: "",
    metadata: "{}",
  });
  const [error, setError] = useState<string | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (status) {
      params.set("status", status);
    }

    if (tag) {
      params.set("tag", tag);
    }

    if (collection) {
      params.set("collection", collection);
    }

    return `/api/documents${params.size ? `?${params.toString()}` : ""}`;
  }, [collection, query, status, tag]);

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(requestUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Document request failed with status ${response.status}`);
      }

      setPayload((await response.json()) as KnowledgePayload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load documents.");
    } finally {
      setIsLoading(false);
    }
  }, [requestUrl]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshDocuments(), 200);
    return () => window.clearTimeout(timeout);
  }, [refreshDocuments]);

  function openEditor(document: KnowledgeDocument) {
    setSelectedDocument(document);
    setForm({
      title: document.title,
      tags: tagsInput(document.tags),
      collection: document.collection ?? "",
      metadata: JSON.stringify(customMetadata(document.metadata), null, 2),
    });
  }

  async function saveDocument() {
    if (!selectedDocument) {
      return;
    }

    setError(null);

    let customMetadataValue: Record<string, unknown>;

    try {
      customMetadataValue = JSON.parse(form.metadata) as Record<string, unknown>;
    } catch {
      setError("Metadata must be valid JSON.");
      return;
    }

    const response = await fetch(`/api/documents/${selectedDocument.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        tags: parseTags(form.tags),
        collection: form.collection || null,
        customMetadata: customMetadataValue,
      }),
    });

    if (!response.ok) {
      setError(`Save failed with status ${response.status}.`);
      return;
    }

    setSelectedDocument(null);
    await refreshDocuments();
  }

  async function archiveDocument(document: KnowledgeDocument) {
    const response = await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });

    if (!response.ok) {
      setError(`Archive failed with status ${response.status}.`);
      return;
    }

    await refreshDocuments();
  }

  async function deleteDocument(document: KnowledgeDocument) {
    const confirmed = window.confirm(`Delete "${document.title}" from the knowledge base?`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });

    if (!response.ok) {
      setError(`Delete failed with status ${response.status}.`);
      return;
    }

    await refreshDocuments();
  }

  const filtersActive = Boolean(query || status || tag || collection);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Database} label="Documents" value={payload.analytics.total} />
        <MetricCard icon={FileText} label="Indexed" value={payload.analytics.indexed} />
        <MetricCard icon={BarChart3} label="Retrievals" value={payload.analytics.retrievals} />
        <MetricCard icon={Tags} label="Tokens" value={payload.analytics.tokens} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]">
            <label className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search documents, tags, collections, source..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="INDEXED">Indexed</option>
              <option value="PROCESSING">Processing</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
            >
              <option value="">All collections</option>
              {payload.facets.collections.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>

            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            >
              <option value="">All tags</option>
              {payload.facets.tags.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              {filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setTag("");
                    setCollection("");
                  }}
                >
                  Clear
                </Button>
              ) : null}
              <Button variant="outline" onClick={refreshDocuments}>
                <RefreshCcw className={cn(isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button asChild>
                <Link href="/dashboard/knowledge-base/upload">
                  <UploadCloud />
                  Upload
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <div className="text-destructive rounded-md border p-3 text-sm">{error}</div> : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Document browser</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {isLoading
                ? "Loading documents..."
                : `${payload.documents.length} matching documents`}
            </p>
          </div>
          <div className="flex rounded-md border p-1">
            <Button
              aria-label="Table view"
              size="icon"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
            >
              <List />
            </Button>
            <Button
              aria-label="Grid view"
              size="icon"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
            >
              <Grid2X2 />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "table" ? (
            <DocumentTable
              documents={payload.documents}
              onArchive={archiveDocument}
              onDelete={deleteDocument}
              onEdit={openEditor}
            />
          ) : (
            <DocumentGrid
              documents={payload.documents}
              onArchive={archiveDocument}
              onDelete={deleteDocument}
              onEdit={openEditor}
            />
          )}
        </CardContent>
      </Card>

      {selectedDocument ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close metadata editor"
            className="bg-background/70 absolute inset-0 backdrop-blur-sm"
            onClick={() => setSelectedDocument(null)}
          />
          <aside className="bg-background absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Document metadata</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Edit tags, collection, and searchable management metadata.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedDocument(null)}>
                Close
              </Button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Title
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Collection
                <Input
                  placeholder="e.g. Product handbook"
                  value={form.collection}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, collection: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Tags
                <Input
                  placeholder="policy, onboarding, support"
                  value={form.tags}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tags: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Custom metadata
                <Textarea
                  className="min-h-48 font-mono text-xs"
                  value={form.metadata}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, metadata: event.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
                <span className="text-muted-foreground">Chunks</span>
                <span className="text-right tabular-nums">{selectedDocument.chunkCount}</span>
                <span className="text-muted-foreground">Tokens</span>
                <span className="text-right tabular-nums">
                  {formatNumber(selectedDocument.tokenCount)}
                </span>
                <span className="text-muted-foreground">Retrievals</span>
                <span className="text-right tabular-nums">{selectedDocument.retrievalCount}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                  Cancel
                </Button>
                <Button onClick={saveDocument}>Save changes</Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
        </div>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentTable({
  documents,
  onArchive,
  onDelete,
  onEdit,
}: {
  documents: KnowledgeDocument[];
  onArchive: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
  onEdit: (document: KnowledgeDocument) => void;
}) {
  if (!documents.length) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase tracking-wide">
          <tr>
            <th className="py-3 pr-4 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Collection</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Usage</th>
            <th className="px-4 py-3 text-right font-medium">Updated</th>
            <th className="py-3 pl-4 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {documents.map((document) => (
            <tr key={document.id} className="hover:bg-muted/40">
              <td className="py-4 pr-4">
                <DocumentIdentity document={document} />
              </td>
              <td className="px-4 py-4">
                <span className="font-medium">{document.collection ?? "Unassigned"}</span>
                <TagList tags={document.tags} />
              </td>
              <td className="px-4 py-4">
                <Badge variant={statusVariant(document.status)}>
                  {document.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                <div>{document.retrievalCount} retrievals</div>
                <div className="text-muted-foreground text-xs">
                  {formatDate(document.lastRetrievedAt)}
                </div>
              </td>
              <td className="px-4 py-4 text-right">{formatDate(document.updatedAt)}</td>
              <td className="py-4 pl-4">
                <DocumentActions
                  document={document}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentGrid({
  documents,
  onArchive,
  onDelete,
  onEdit,
}: {
  documents: KnowledgeDocument[];
  onArchive: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
  onEdit: (document: KnowledgeDocument) => void;
}) {
  if (!documents.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => (
        <div key={document.id} className="rounded-md border p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <DocumentIdentity document={document} />
            <Badge variant={statusVariant(document.status)}>{document.status.toLowerCase()}</Badge>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
            <Stat label="Chunks" value={document.chunkCount} />
            <Stat label="Tokens" value={formatNumber(document.tokenCount)} />
            <Stat label="Uses" value={document.retrievalCount} />
          </div>
          <div className="mb-4">
            <p className="text-muted-foreground text-xs">Collection</p>
            <p className="mt-1 text-sm font-medium">{document.collection ?? "Unassigned"}</p>
            <TagList tags={document.tags} />
          </div>
          <DocumentActions
            document={document}
            onArchive={onArchive}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </div>
      ))}
    </div>
  );
}

function DocumentIdentity({ document }: { document: KnowledgeDocument }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <FileText className="text-primary size-4 shrink-0" />
        <p className="truncate font-medium">{document.title}</p>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {document.sourceType.toLowerCase()} · {formatBytes(document.size)} · {document.chunkCount}{" "}
        chunks
      </p>
      {document.errorMessage ? (
        <p className="text-destructive mt-1 text-xs">{document.errorMessage}</p>
      ) : null}
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <p className="text-muted-foreground mt-2 text-xs">No tags</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.slice(0, 4).map((tag) => (
        <Badge key={tag} variant="outline">
          {tag}
        </Badge>
      ))}
      {tags.length > 4 ? <Badge variant="outline">+{tags.length - 4}</Badge> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function DocumentActions({
  document,
  onArchive,
  onDelete,
  onEdit,
}: {
  document: KnowledgeDocument;
  onArchive: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
  onEdit: (document: KnowledgeDocument) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => onEdit(document)}>
        <Pencil />
        Edit
      </Button>
      {document.status !== "ARCHIVED" ? (
        <Button size="sm" variant="outline" onClick={() => onArchive(document)}>
          <Archive />
          Archive
        </Button>
      ) : null}
      <Button size="sm" variant="destructive" onClick={() => onDelete(document)}>
        <Trash2 />
        Delete
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
      <Database className="mb-3 size-8" />
      <p className="font-medium">No documents match the current filters.</p>
      <p className="mt-1 text-sm">Upload documents or clear filters to expand the result set.</p>
    </div>
  );
}
