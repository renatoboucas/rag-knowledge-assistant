import { env } from "@/lib/env";
import { ModelRegistry } from "@/lib/ai/model-registry";
import type {
  AiModelProfile,
  AiProviderName,
  AiRoutePlan,
  AiRouteRequest,
  AiRoutingStrategy,
} from "@/lib/ai/types";

function fallbackOrder() {
  return env.AI_FALLBACK_ORDER.split(",")
    .map((provider) => provider.trim())
    .filter((provider): provider is AiProviderName =>
      ["openai", "anthropic", "gemini"].includes(provider),
    );
}

function scoreModel(model: AiModelProfile, strategy: AiRoutingStrategy) {
  if (strategy === "cost") {
    return 1 / (model.estimatedInputCostPer1k + model.estimatedOutputCostPer1k);
  }

  if (strategy === "latency") {
    return model.latencyScore;
  }

  if (strategy === "quality") {
    return model.qualityScore;
  }

  return model.qualityScore * 0.5 + model.latencyScore * 0.25 + costScore(model) * 0.25;
}

function costScore(model: AiModelProfile) {
  return Math.min(1, 0.02 / (model.estimatedInputCostPer1k + model.estimatedOutputCostPer1k));
}

export class ModelRouter {
  constructor(private readonly registry = new ModelRegistry()) {}

  route(request: AiRouteRequest): AiRoutePlan {
    const strategy = request.strategy ?? env.AI_ROUTING_STRATEGY;
    const available = this.registry
      .available()
      .filter((model) => (request.requireStreaming ? model.supportsStreaming : true));

    if (!available.length) {
      throw new Error(
        "No configured LLM providers are available. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.",
      );
    }

    const preferredProvider = request.preferredProvider ?? env.AI_PRIMARY_PROVIDER;
    const preferred = available.find((model) => model.provider === preferredProvider);
    const orderedProviders = fallbackOrder();
    const sorted = [...available].sort((a, b) => {
      const scoreDelta = scoreModel(b, strategy) - scoreModel(a, strategy);

      if (Math.abs(scoreDelta) > 0.001) {
        return scoreDelta;
      }

      return orderedProviders.indexOf(a.provider) - orderedProviders.indexOf(b.provider);
    });

    const selected = preferred && strategy === "balanced" ? preferred : (sorted[0] ?? preferred);

    if (!selected) {
      throw new Error("Unable to select an LLM model.");
    }

    const fallbacks = sorted.filter((model) => model.provider !== selected.provider);

    return {
      selected,
      fallbacks,
      strategy,
      reason:
        selected.provider === preferredProvider && strategy === "balanced"
          ? "primary provider selected for balanced routing"
          : `${strategy} routing selected highest-scoring available provider`,
    };
  }
}
