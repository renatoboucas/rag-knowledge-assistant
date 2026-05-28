import type { TranscriptSummary } from "@rag/types";

function timestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function exportTranscript(transcript: TranscriptSummary, format: "txt" | "json" | "vtt") {
  if (format === "json") {
    return {
      body: JSON.stringify(transcript, null, 2),
      contentType: "application/json",
      extension: "json",
    };
  }

  if (format === "vtt") {
    const cues = transcript.segments
      ?.map((segment) => {
        const start = timestamp(segment.startMs);
        const end = timestamp(segment.endMs);
        const speaker = segment.speakerLabel ? `${segment.speakerLabel}: ` : "";
        return `${start}.000 --> ${end}.000\n${speaker}${segment.correctedText ?? segment.text}`;
      })
      .join("\n\n");

    return {
      body: `WEBVTT\n\n${cues ?? ""}\n`,
      contentType: "text/vtt",
      extension: "vtt",
    };
  }

  const body =
    transcript.segments
      ?.map((segment) => {
        const speaker = segment.speakerLabel ? `${segment.speakerLabel}: ` : "";
        return `[${timestamp(segment.startMs)}] ${speaker}${segment.correctedText ?? segment.text}`;
      })
      .join("\n") ||
    transcript.correctedText ||
    transcript.fullText;

  return {
    body,
    contentType: "text/plain",
    extension: "txt",
  };
}
