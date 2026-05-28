import type { VoiceProviderCapability } from "@rag/types";

import { env } from "@/lib/env";
import type { VoiceProviderAdapter } from "@/lib/voice/types";

class OpenAiRealtimeProvider implements VoiceProviderAdapter {
  capability(): VoiceProviderCapability {
    return {
      provider: "openai_realtime",
      label: "OpenAI Realtime",
      configured: Boolean(env.OPENAI_API_KEY),
      supportsWebrtc: true,
      supportsStreaming: true,
      supportsVad: true,
      supportsInterruptions: true,
    };
  }
}

class ElevenLabsProvider implements VoiceProviderAdapter {
  capability(): VoiceProviderCapability {
    return {
      provider: "elevenlabs",
      label: "ElevenLabs",
      configured: Boolean(env.ELEVENLABS_API_KEY),
      supportsWebrtc: false,
      supportsStreaming: true,
      supportsVad: false,
      supportsInterruptions: true,
    };
  }
}

class DeepgramProvider implements VoiceProviderAdapter {
  capability(): VoiceProviderCapability {
    return {
      provider: "deepgram",
      label: "Deepgram",
      configured: Boolean(env.DEEPGRAM_API_KEY),
      supportsWebrtc: false,
      supportsStreaming: true,
      supportsVad: true,
      supportsInterruptions: false,
    };
  }
}

export class VoiceProviderRegistry {
  private readonly providers = [
    new OpenAiRealtimeProvider(),
    new ElevenLabsProvider(),
    new DeepgramProvider(),
  ];

  capabilities() {
    return this.providers.map((provider) => provider.capability());
  }

  getOpenAiRealtimeCapability() {
    return this.capabilities().find((capability) => capability.provider === "openai_realtime");
  }
}

export const voiceProviders = new VoiceProviderRegistry();
