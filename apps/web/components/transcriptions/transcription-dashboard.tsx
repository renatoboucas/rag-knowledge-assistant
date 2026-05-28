"use client";

import { useState } from "react";
import {
  Captions,
  Download,
  Languages,
  Mic,
  RefreshCw,
  Search,
  Square,
  UserRound,
} from "lucide-react";
import { Button, Card, CardContent, cn } from "@rag/ui";

import { useLiveTranscription } from "@/hooks/use-live-transcription";

function ms(value: number) {
  const seconds = Math.floor(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TranscriptionDashboard() {
  const transcription = useLiveTranscription();
  const [editingSegmentId, setEditingSegmentId] = useState<string>();
  const [draft, setDraft] = useState("");

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Live transcription</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Streaming ingestion, diarization metadata, and export-ready transcripts.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  transcription.isStreaming && "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                {transcription.isStreaming ? "Streaming" : "Idle"}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={transcription.isStreaming}
                onClick={() => void transcription.start()}
              >
                <Mic />
                Start
              </Button>
              <Button
                disabled={!transcription.isStreaming}
                variant="outline"
                onClick={() => void transcription.stop()}
              >
                <Square />
                Stop
              </Button>
              <Button variant="ghost" onClick={() => void transcription.reload()}>
                <RefreshCw />
              </Button>
            </div>

            {transcription.error ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                {transcription.error}
              </div>
            ) : null}

            <div className="space-y-2">
              {transcription.capabilities.map((capability) => (
                <div
                  key={capability.provider}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{capability.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {capability.supportsSpeakerDetection ? "Speakers" : "Single speaker"} ·{" "}
                      {capability.supportsMultiLanguage ? "Multilingual" : "Single language"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      capability.configured
                        ? "border-emerald-500/30 text-emerald-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {capability.configured ? "Ready" : "Missing key"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                className="bg-background w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
                placeholder="Search transcripts..."
                value={transcription.query}
                onChange={(event) => transcription.setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void transcription.reload(transcription.query);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              {transcription.transcripts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="hover:bg-muted w-full rounded-lg border p-3 text-left transition-colors"
                  onClick={() => transcription.setActiveTranscript(item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                    <span className="text-muted-foreground text-xs">{item.status}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {item.fullText || "No captured text yet."}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-primary flex items-center gap-2 text-sm font-medium">
                <Captions className="size-4" />
                Transcript workspace
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                {transcription.activeTranscript?.title ?? "No transcript selected"}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {transcription.activeTranscript
                  ? `${transcription.activeTranscript.wordCount} words · ${transcription.activeTranscript.speakerCount} speakers`
                  : "Start a live transcription session or select an existing transcript."}
              </p>
            </div>

            {transcription.activeTranscript ? (
              <div className="flex gap-2">
                {(["txt", "vtt", "json"] as const).map((format) => (
                  <Button key={format} asChild size="sm" variant="outline">
                    <a
                      href={`/api/transcriptions/export?transcriptId=${transcription.activeTranscript?.id}&format=${format}`}
                    >
                      <Download />
                      {format.toUpperCase()}
                    </a>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          {transcription.interimText ? (
            <div className="border-primary/30 bg-primary/10 text-primary rounded-lg border p-4 text-sm">
              {transcription.interimText}
            </div>
          ) : null}

          <div className="space-y-3">
            {transcription.activeTranscript?.segments?.length ? (
              transcription.activeTranscript.segments.map((segment) => (
                <div key={segment.id} className="rounded-lg border p-4">
                  <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" />
                      {segment.speakerLabel ?? "Speaker"}
                    </span>
                    <span>
                      {ms(segment.startMs)} - {ms(segment.endMs)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Languages className="size-3" />
                      {segment.language}
                    </span>
                  </div>

                  {editingSegmentId === segment.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="bg-background min-h-20 w-full resize-none rounded-md border p-3 text-sm outline-none"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            void transcription.correctSegment(segment.id, draft);
                            setEditingSegmentId(undefined);
                          }}
                        >
                          Save correction
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSegmentId(undefined)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left text-sm leading-6"
                      onClick={() => {
                        setEditingSegmentId(segment.id);
                        setDraft(segment.correctedText ?? segment.text);
                      }}
                    >
                      {segment.correctedText ?? segment.text}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
                Transcript segments will appear here in real time.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
