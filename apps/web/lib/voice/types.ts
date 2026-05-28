import type {
  VoiceProvider,
  VoiceProviderCapability,
  VoiceSessionState,
  VoiceSessionSummary,
} from "@rag/types";

export type VoiceTransport = "webrtc" | "websocket";

export type VoiceSessionConfig = {
  provider: VoiceProvider;
  model: string;
  voice?: string;
  transport: VoiceTransport;
  instructions: string;
  inputAudioFormat: "pcm16" | "g711_ulaw" | "g711_alaw";
  outputAudioFormat: "pcm16" | "g711_ulaw" | "g711_alaw";
  sampleRate: number;
  turnDetection: {
    type: "server_vad" | "semantic_vad";
    threshold: number;
    prefixPaddingMs: number;
    silenceDurationMs: number;
  };
};

export type VoiceSessionRecord = VoiceSessionSummary & {
  metadata: Record<string, unknown>;
};

export type RealtimeClientSecret = {
  value: string;
  expiresAt?: number;
};

export type RealtimeSessionToken = {
  sessionId: string;
  provider: "openai_realtime";
  model: string;
  voice: string;
  endpoint: string;
  clientSecret: RealtimeClientSecret;
  config: VoiceSessionConfig;
};

export type VoiceProviderAdapter = {
  capability(): VoiceProviderCapability;
};

export type VoiceSessionUpdate = {
  status?: VoiceSessionState;
  transcriptItem?: {
    role: "user" | "assistant" | "system";
    text: string;
    startedAt?: string;
    endedAt?: string;
  };
  metrics?: Record<string, unknown>;
  errorMessage?: string;
};
