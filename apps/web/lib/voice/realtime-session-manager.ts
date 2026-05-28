import { env } from "@/lib/env";
import type { RealtimeSessionToken, VoiceSessionConfig } from "@/lib/voice/types";

type OpenAiClientSecretResponse = {
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
  value?: string;
  expires_at?: number;
  error?: {
    message?: string;
  };
};

const realtimeEndpoint = "https://api.openai.com/v1/realtime";

export function defaultVoiceSessionConfig(
  overrides: Partial<VoiceSessionConfig> = {},
): VoiceSessionConfig {
  return {
    provider: "openai_realtime",
    model: env.OPENAI_REALTIME_MODEL,
    voice: env.OPENAI_REALTIME_VOICE,
    transport: "webrtc",
    instructions:
      "You are an enterprise RAG voice assistant. Keep responses concise, acknowledge interruptions, and ask clarifying questions before taking high-impact actions.",
    inputAudioFormat: "pcm16",
    outputAudioFormat: "pcm16",
    sampleRate: 24000,
    turnDetection: {
      type: "server_vad",
      threshold: 0.5,
      prefixPaddingMs: 300,
      silenceDurationMs: 500,
    },
    ...overrides,
  };
}

export class RealtimeSessionManager {
  async createOpenAiClientSecret(input: {
    sessionId: string;
    organizationId: string;
    userId: string;
    config: VoiceSessionConfig;
  }): Promise<RealtimeSessionToken> {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI Realtime voice sessions.");
    }

    const response = await fetch(`${realtimeEndpoint}/client_secrets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: input.config.model,
          instructions: input.config.instructions,
          audio: {
            input: {
              format: { type: input.config.inputAudioFormat },
              turn_detection: {
                type: input.config.turnDetection.type,
                threshold: input.config.turnDetection.threshold,
                prefix_padding_ms: input.config.turnDetection.prefixPaddingMs,
                silence_duration_ms: input.config.turnDetection.silenceDurationMs,
              },
            },
            output: {
              format: { type: input.config.outputAudioFormat },
              voice: input.config.voice,
            },
          },
          metadata: {
            app_session_id: input.sessionId,
            organization_id: input.organizationId,
            user_id: input.userId,
          },
        },
        ttl_seconds: env.VOICE_SESSION_TTL_SECONDS,
      }),
    });

    const payload = (await response.json()) as OpenAiClientSecretResponse;
    const value = payload.client_secret?.value ?? payload.value;

    if (!response.ok || !value) {
      throw new Error(payload.error?.message ?? "Unable to create OpenAI Realtime client secret.");
    }

    return {
      sessionId: input.sessionId,
      provider: "openai_realtime",
      model: input.config.model,
      voice: input.config.voice ?? env.OPENAI_REALTIME_VOICE,
      endpoint: realtimeEndpoint,
      clientSecret: {
        value,
        expiresAt: payload.client_secret?.expires_at ?? payload.expires_at,
      },
      config: input.config,
    };
  }
}

export const realtimeSessionManager = new RealtimeSessionManager();
