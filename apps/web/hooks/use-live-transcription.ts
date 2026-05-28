"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AudioSessionSummary,
  TranscriptionProviderCapability,
  TranscriptSegmentSummary,
  TranscriptSummary,
} from "@rag/types";

type SpeechRecognitionEventResult = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult:
    | ((event: { results: ArrayLike<SpeechRecognitionEventResult>; resultIndex: number }) => void)
    | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type TranscriptionPayload = {
  transcripts?: TranscriptSummary[];
  capabilities?: TranscriptionProviderCapability[];
};

type CreateSessionPayload = {
  audioSession?: AudioSessionSummary;
  transcript?: TranscriptSummary;
  message?: string;
};

function speechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition;
}

export function useLiveTranscription() {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [capabilities, setCapabilities] = useState<TranscriptionProviderCapability[]>([]);
  const [activeTranscript, setActiveTranscript] = useState<TranscriptSummary>();
  const [activeAudioSession, setActiveAudioSession] = useState<AudioSessionSummary>();
  const [interimText, setInterimText] = useState("");
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | undefined>(undefined);

  const load = useCallback(
    async (search = query) => {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/transcriptions/sessions${params}`, { cache: "no-store" });
      const payload = (await response.json()) as TranscriptionPayload;
      setTranscripts(payload.transcripts ?? []);
      setCapabilities(payload.capabilities ?? []);
    },
    [query],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  const ingestSegment = useCallback(
    async (segment: {
      text: string;
      confidence?: number;
      startMs: number;
      endMs: number;
      speakerLabel?: string;
      language: string;
    }) => {
      if (!activeTranscript) {
        return;
      }

      const response = await fetch("/api/transcriptions/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: activeTranscript.id, ...segment }),
      });
      const payload = (await response.json()) as { segment?: TranscriptSegmentSummary };

      const savedSegment = payload.segment;

      if (savedSegment) {
        setActiveTranscript((current) =>
          current
            ? {
                ...current,
                fullText: `${current.fullText} ${savedSegment.text}`.trim(),
                segments: [...(current.segments ?? []), savedSegment],
              }
            : current,
        );
      }
    },
    [activeTranscript],
  );

  const start = useCallback(async () => {
    setError(undefined);
    const Recognition = speechRecognitionConstructor();

    if (!Recognition) {
      setError("This browser does not expose a live SpeechRecognition engine.");
      return;
    }

    const response = await fetch("/api/transcriptions/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Live transcript ${new Date().toLocaleString()}`,
        provider: "whisper",
        language: "en",
        speakerDetection: true,
        multiLanguage: true,
      }),
    });
    const payload = (await response.json()) as CreateSessionPayload;

    if (!response.ok || !payload.transcript || !payload.audioSession) {
      setError(payload.message ?? "Unable to create transcription session.");
      return;
    }

    setActiveTranscript(payload.transcript);
    setActiveAudioSession(payload.audioSession);
    startedAtRef.current = Date.now();

    await fetch(`/api/transcriptions/sessions/${payload.audioSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "streaming" }),
    });

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = payload.transcript.language || "en";
    recognition.onstart = () => setIsStreaming(true);
    recognition.onend = () => setIsStreaming(false);
    recognition.onerror = (event) => setError(event.error ?? "Transcription stream failed.");
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];

        if (!alternative) {
          continue;
        }

        if (result.isFinal) {
          const now = Date.now();
          void ingestSegment({
            text: alternative.transcript.trim(),
            confidence: alternative.confidence,
            startMs: startedAtRef.current ? now - startedAtRef.current : 0,
            endMs: startedAtRef.current ? now - startedAtRef.current + 500 : 500,
            speakerLabel: "Speaker 1",
            language: recognition.lang,
          });
          setInterimText("");
        } else {
          setInterimText(alternative.transcript);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [ingestSegment]);

  const stop = useCallback(async () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsStreaming(false);

    if (activeAudioSession) {
      await fetch(`/api/transcriptions/sessions/${activeAudioSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      await load("");
    }
  }, [activeAudioSession, load]);

  const correctSegment = useCallback(async (segmentId: string, correctedText: string) => {
    const response = await fetch(`/api/transcriptions/segments/${segmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctedText, reason: "manual_editor" }),
    });
    const payload = (await response.json()) as { segment?: TranscriptSegmentSummary };

    if (payload.segment) {
      setActiveTranscript((current) =>
        current
          ? {
              ...current,
              segments: current.segments?.map((segment) =>
                segment.id === payload.segment?.id ? payload.segment : segment,
              ),
            }
          : current,
      );
    }
  }, []);

  return {
    transcripts,
    capabilities,
    activeTranscript,
    interimText,
    query,
    isStreaming,
    error,
    setQuery,
    setActiveTranscript,
    start,
    stop,
    correctSegment,
    reload: load,
  };
}
