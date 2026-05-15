import { env } from "@/lib/env";
import type { AiModelProfile, AiProviderName } from "@/lib/ai/types";

const providerKeyMap = {
  openai: () => env.OPENAI_API_KEY,
  anthropic: () => env.ANTHROPIC_API_KEY,
  gemini: () => env.GOOGLE_API_KEY,
} satisfies Record<AiProviderName, () => string | undefined>;

export class ModelRegistry {
  list(): AiModelProfile[] {
    return [
      {
        provider: "openai",
        model: env.OPENAI_CHAT_MODEL,
        displayName: `OpenAI ${env.OPENAI_CHAT_MODEL}`,
        qualityScore: 0.94,
        latencyScore: 0.78,
        estimatedInputCostPer1k: 0.002,
        estimatedOutputCostPer1k: 0.008,
        supportsStreaming: true,
        maxOutputTokens: 4096,
      },
      {
        provider: "anthropic",
        model: env.ANTHROPIC_CHAT_MODEL,
        displayName: `Anthropic ${env.ANTHROPIC_CHAT_MODEL}`,
        qualityScore: 0.95,
        latencyScore: 0.72,
        estimatedInputCostPer1k: 0.003,
        estimatedOutputCostPer1k: 0.015,
        supportsStreaming: true,
        maxOutputTokens: 4096,
      },
      {
        provider: "gemini",
        model: env.GEMINI_CHAT_MODEL,
        displayName: `Gemini ${env.GEMINI_CHAT_MODEL}`,
        qualityScore: 0.88,
        latencyScore: 0.9,
        estimatedInputCostPer1k: 0.0003,
        estimatedOutputCostPer1k: 0.0025,
        supportsStreaming: true,
        maxOutputTokens: 4096,
      },
    ];
  }

  available() {
    return this.list().filter((model) => Boolean(providerKeyMap[model.provider]()));
  }

  hasCredentials(provider: AiProviderName) {
    return Boolean(providerKeyMap[provider]());
  }
}
