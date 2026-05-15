import type { AiModelProfile } from "@/lib/ai/types";
import type { TokenUsage } from "@/lib/observability/types";

export function estimateModelCost(model: AiModelProfile, usage: TokenUsage) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  return (
    (inputTokens / 1000) * model.estimatedInputCostPer1k +
    (outputTokens / 1000) * model.estimatedOutputCostPer1k
  );
}
