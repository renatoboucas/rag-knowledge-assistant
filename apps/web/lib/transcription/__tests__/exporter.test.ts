import { describe, expect, it } from "vitest";
import type { TranscriptSummary } from "@rag/types";

import { exportTranscript } from "@/lib/transcription/exporter";

const transcript: TranscriptSummary = {
  id: "tr_1",
  audioSessionId: "as_1",
  title: "Demo",
  status: "completed",
  language: "en",
  detectedLanguages: ["en"],
  speakerCount: 1,
  durationMs: 1500,
  wordCount: 4,
  confidence: 0.95,
  fullText: "Hello there",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  segments: [
    {
      id: "seg_1",
      segmentIndex: 0,
      speakerLabel: "Speaker 1",
      language: "en",
      text: "Hello there",
      startMs: 0,
      endMs: 1500,
      confidence: 0.95,
      createdAt: new Date(0).toISOString(),
    },
  ],
};

describe("transcript exporter", () => {
  it("exports speaker and timestamp text", () => {
    const exported = exportTranscript(transcript, "txt");

    expect(exported.contentType).toBe("text/plain");
    expect(exported.body).toContain("[00:00] Speaker 1: Hello there");
  });

  it("exports json transcripts", () => {
    const exported = exportTranscript(transcript, "json");

    expect(exported.contentType).toBe("application/json");
    expect(JSON.parse(exported.body)).toMatchObject({ id: "tr_1", title: "Demo" });
  });
});
