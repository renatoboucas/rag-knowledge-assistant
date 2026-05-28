import type {
  AudioSessionStatus,
  TranscriptionProvider,
  TranscriptionProviderCapability,
  TranscriptStatus,
} from "@rag/types";

export type TranscriptionSessionConfig = {
  provider: TranscriptionProvider;
  language: string;
  sampleRate: number;
  channels: number;
  encoding: "linear16" | "opus" | "webm" | "wav";
  source: "microphone" | "upload" | "voice_session" | "connector";
  speakerDetection: boolean;
  timestamps: boolean;
  multiLanguage: boolean;
};

export type TranscriptSegmentInput = {
  transcriptId: string;
  text: string;
  speakerLabel?: string;
  language?: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  words?: Array<{
    text: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
  metadata?: Record<string, unknown>;
};

export type TranscriptCorrectionInput = {
  correctedText: string;
  reason?: string;
};

export type TranscriptionProviderAdapter = {
  capability(): TranscriptionProviderCapability;
  streamingConfig(config: TranscriptionSessionConfig): {
    transport: "websocket" | "http";
    sampleRate: number;
    encoding: string;
    language: string;
    endpoint?: string;
    headers?: Record<string, string>;
  };
};

export type AudioSessionUpdate = {
  status?: AudioSessionStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export type TranscriptUpdate = {
  status?: TranscriptStatus;
  correctedText?: string;
};
