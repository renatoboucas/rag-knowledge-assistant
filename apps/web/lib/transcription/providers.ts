import type { TranscriptionProvider, TranscriptionProviderCapability } from "@rag/types";

import { env } from "@/lib/env";
import type {
  TranscriptionProviderAdapter,
  TranscriptionSessionConfig,
} from "@/lib/transcription/types";

class DeepgramProvider implements TranscriptionProviderAdapter {
  capability(): TranscriptionProviderCapability {
    return {
      provider: "deepgram",
      label: "Deepgram",
      configured: Boolean(env.DEEPGRAM_API_KEY),
      supportsStreaming: true,
      supportsSpeakerDetection: true,
      supportsTimestamps: true,
      supportsMultiLanguage: true,
      supportsCorrection: false,
    };
  }

  streamingConfig(config: TranscriptionSessionConfig) {
    return {
      transport: "websocket" as const,
      sampleRate: config.sampleRate,
      encoding: config.encoding,
      language: config.language,
      endpoint: "wss://api.deepgram.com/v1/listen",
      headers: env.DEEPGRAM_API_KEY
        ? { Authorization: `Token ${env.DEEPGRAM_API_KEY}` }
        : undefined,
    };
  }
}

class WhisperProvider implements TranscriptionProviderAdapter {
  capability(): TranscriptionProviderCapability {
    return {
      provider: "whisper",
      label: "Whisper",
      configured: Boolean(env.OPENAI_API_KEY),
      supportsStreaming: true,
      supportsSpeakerDetection: false,
      supportsTimestamps: true,
      supportsMultiLanguage: true,
      supportsCorrection: true,
    };
  }

  streamingConfig(config: TranscriptionSessionConfig) {
    return {
      transport: "websocket" as const,
      sampleRate: config.sampleRate,
      encoding: config.encoding,
      language: config.language,
      endpoint: "wss://api.openai.com/v1/realtime/transcription_sessions",
    };
  }
}

class AssemblyAiProvider implements TranscriptionProviderAdapter {
  capability(): TranscriptionProviderCapability {
    return {
      provider: "assemblyai",
      label: "AssemblyAI",
      configured: Boolean(env.ASSEMBLYAI_API_KEY),
      supportsStreaming: true,
      supportsSpeakerDetection: true,
      supportsTimestamps: true,
      supportsMultiLanguage: true,
      supportsCorrection: false,
    };
  }

  streamingConfig(config: TranscriptionSessionConfig) {
    return {
      transport: "websocket" as const,
      sampleRate: config.sampleRate,
      encoding: config.encoding,
      language: config.language,
      endpoint: "wss://streaming.assemblyai.com/v3/ws",
      headers: env.ASSEMBLYAI_API_KEY ? { Authorization: env.ASSEMBLYAI_API_KEY } : undefined,
    };
  }
}

export class TranscriptionProviderRegistry {
  private readonly providers = {
    deepgram: new DeepgramProvider(),
    whisper: new WhisperProvider(),
    assemblyai: new AssemblyAiProvider(),
  } satisfies Record<TranscriptionProvider, TranscriptionProviderAdapter>;

  capabilities() {
    return Object.values(this.providers).map((provider) => provider.capability());
  }

  get(provider: TranscriptionProvider) {
    return this.providers[provider];
  }
}

export const transcriptionProviders = new TranscriptionProviderRegistry();
