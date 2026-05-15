"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, RefreshCcw, UploadCloud, XCircle } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@rag/ui";

type UploadStatus = "PENDING" | "PROCESSING" | "INDEXED" | "FAILED" | "ARCHIVED";

type UploadHistoryItem = {
  id: string;
  title: string;
  status: UploadStatus;
  mimeType?: string | null;
  chunkCount: number;
  tokenCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  size?: number;
  checksum?: string;
};

type ClientQueueItem = {
  id: string;
  filename: string;
  progress: number;
  status: "queued" | "uploading" | "accepted" | "failed";
  error?: string;
};

function formatBytes(bytes?: number) {
  if (!bytes) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function statusVariant(status: UploadStatus) {
  if (status === "INDEXED") {
    return "secondary";
  }

  if (status === "FAILED") {
    return "destructive";
  }

  return "outline";
}

export function UploadDashboard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<ClientQueueItem[]>([]);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeQueue = useMemo(
    () => queue.filter((item) => item.status === "queued" || item.status === "uploading"),
    [queue],
  );

  const refreshHistory = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/uploads", { cache: "no-store" });
      const payload = (await response.json()) as { items?: UploadHistoryItem[] };
      setHistory(payload.items ?? []);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
    const interval = window.setInterval(() => void refreshHistory(), 3500);
    return () => window.clearInterval(interval);
  }, [refreshHistory]);

  function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);

    if (!selected.length) {
      return;
    }

    const ids = selected.map(() => crypto.randomUUID());
    setQueue((current) => [
      ...ids.map((id, index) => ({
        id,
        filename: selected[index]?.name ?? "Upload",
        progress: 0,
        status: "queued" as const,
      })),
      ...current,
    ]);

    const formData = new FormData();
    selected.forEach((file) => formData.append("files", file));

    const request = new XMLHttpRequest();
    request.open("POST", "/api/uploads");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      setQueue((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, progress, status: "uploading" } : item,
        ),
      );
    };
    request.onload = () => {
      const ok = request.status >= 200 && request.status < 300;
      setQueue((current) =>
        current.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                progress: 100,
                status: ok ? "accepted" : "failed",
                error: ok ? undefined : "Upload request failed.",
              }
            : item,
        ),
      );
      void refreshHistory();
    };
    request.onerror = () => {
      setQueue((current) =>
        current.map((item) =>
          ids.includes(item.id)
            ? { ...item, status: "failed", error: "Network error while uploading." }
            : item,
        ),
      );
    };
    request.send(formData);
  }

  async function retryUpload(documentId: string) {
    await fetch(`/api/uploads/${documentId}/retry`, { method: "POST" });
    await refreshHistory();
  }

  async function retryEmbedding(documentId: string) {
    await fetch(`/api/embeddings/${documentId}`, { method: "POST" });
    await refreshHistory();
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload documents</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className={cn(
              "flex min-h-56 w-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/10" : "border-border bg-muted/30",
            )}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              uploadFiles(event.dataTransfer.files);
            }}
          >
            <UploadCloud className="text-primary mb-4 size-10" />
            <span className="text-lg font-semibold">Drop files here or browse</span>
            <span className="text-muted-foreground mt-2 text-sm">
              PDF, DOCX, TXT, and Markdown. Upload multiple files at once.
            </span>
          </button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            onChange={(event) => {
              if (event.target.files) {
                uploadFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upload queue</CardTitle>
          <Badge variant="outline">{activeQueue.length} active</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length ? (
            queue.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.filename}</p>
                    <p className="text-muted-foreground text-xs">{item.error ?? item.status}</p>
                  </div>
                  <span className="text-sm tabular-nums">{item.progress}%</span>
                </div>
                <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No files queued.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upload history</CardTitle>
          <Button disabled={isRefreshing} size="sm" variant="outline" onClick={refreshHistory}>
            <RefreshCcw />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length ? (
            history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-md border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary size-4" />
                    <p className="truncate font-medium">{item.title}</p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatBytes(item.size)} · {item.chunkCount} chunks · {item.tokenCount} tokens
                  </p>
                  {item.errorMessage ? (
                    <p className="text-destructive mt-2 flex items-center gap-2 text-sm">
                      <XCircle className="size-4" />
                      {item.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(item.status)}>{item.status.toLowerCase()}</Badge>
                  {item.status === "FAILED" ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => retryUpload(item.id)}>
                        <RefreshCcw />
                        Retry upload
                      </Button>
                      {item.chunkCount > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => retryEmbedding(item.id)}>
                          <RefreshCcw />
                          Retry embeddings
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground rounded-md border p-6 text-sm">
              No uploads yet. <Link href="/dashboard/knowledge-base/upload">Upload documents</Link>{" "}
              to start indexing.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
