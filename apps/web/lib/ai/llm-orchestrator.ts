import { ModelRouter } from "@/lib/ai/model-router";
import { AiProviderFactory } from "@/lib/ai/provider-factory";
import { estimateTokenCount } from "@/lib/memory/token-counter";
import { estimateModelCost } from "@/lib/observability/cost";
import { createLangSmithTrace } from "@/lib/observability/langsmith";
import { telemetry } from "@/lib/observability/telemetry";
import type {
  AiInvokeRequest,
  AiInvokeResult,
  AiModelProfile,
  AiStreamRequest,
} from "@/lib/ai/types";

function requestTokenEstimate(messages: { content: unknown }[]) {
  return messages.reduce((total, message) => {
    if (typeof message.content === "string") {
      return total + estimateTokenCount(message.content);
    }

    return total + estimateTokenCount(JSON.stringify(message.content ?? ""));
  }, 0);
}

export class LlmOrchestrator {
  constructor(
    private readonly router = new ModelRouter(),
    private readonly factory = new AiProviderFactory(),
  ) {}

  async stream(request: AiStreamRequest) {
    const route = this.router.route({ ...request, requireStreaming: true });
    let lastError: unknown;
    const startedAt = Date.now();
    const inputTokens = requestTokenEstimate(request.messages);

    for (const model of [route.selected, ...route.fallbacks]) {
      try {
        const chatModel = this.factory.create(model, {
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });
        const stream = await chatModel.stream(request.messages);
        const latencyMs = Date.now() - startedAt;
        const usage = { inputTokens, totalTokens: inputTokens };

        await telemetry.captureEvent({
          category: "ai",
          name: "ai.stream.started",
          provider: model.provider,
          model: model.model,
          usage,
          estimatedCost: estimateModelCost(model, usage),
          latencyMs,
          metadata: {
            task: request.task,
            strategy: route.strategy,
            fallbackCount: route.fallbacks.length,
          },
        });
        await createLangSmithTrace({
          id: crypto.randomUUID(),
          name: `ai.stream.${request.task}`,
          runType: "llm",
          inputs: { task: request.task, provider: model.provider, model: model.model },
          outputs: { streamStarted: true },
          metadata: { strategy: route.strategy, latencyMs },
        });

        return {
          stream,
          route: this.withSelected(route, model),
        };
      } catch (error) {
        lastError = error;
        await telemetry.captureError(error, {
          name: "ai.stream.failed",
          provider: model.provider,
          model: model.model,
          latencyMs: Date.now() - startedAt,
          metadata: { task: request.task },
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error("All LLM providers failed.");
  }

  async invoke(request: AiInvokeRequest): Promise<AiInvokeResult> {
    const route = this.router.route(request);
    let lastError: unknown;
    const startedAt = Date.now();
    const inputTokens = requestTokenEstimate(request.messages);

    for (const model of [route.selected, ...route.fallbacks]) {
      try {
        const chatModel = this.factory.create(model, {
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });
        const response = await chatModel.invoke(request.messages);
        const outputTokens = estimateTokenCount(
          typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content),
        );
        const usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
        const latencyMs = Date.now() - startedAt;

        await telemetry.captureEvent({
          category: "ai",
          name: "ai.invoke.completed",
          provider: model.provider,
          model: model.model,
          usage,
          estimatedCost: estimateModelCost(model, usage),
          latencyMs,
          metadata: {
            task: request.task,
            strategy: route.strategy,
            fallbackCount: route.fallbacks.length,
          },
        });
        await createLangSmithTrace({
          id: crypto.randomUUID(),
          name: `ai.invoke.${request.task}`,
          runType: "llm",
          inputs: { task: request.task, provider: model.provider, model: model.model },
          outputs: { outputTokens },
          metadata: { strategy: route.strategy, latencyMs },
        });

        return {
          content: response.content,
          route: this.withSelected(route, model),
        };
      } catch (error) {
        lastError = error;
        await telemetry.captureError(error, {
          name: "ai.invoke.failed",
          provider: model.provider,
          model: model.model,
          latencyMs: Date.now() - startedAt,
          metadata: { task: request.task },
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error("All LLM providers failed.");
  }

  private withSelected(route: ReturnType<ModelRouter["route"]>, selected: AiModelProfile) {
    return {
      ...route,
      selected,
      fallbacks: route.fallbacks.filter((model) => model.provider !== selected.provider),
    };
  }
}
