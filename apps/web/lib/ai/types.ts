import type { BaseMessage } from "@langchain/core/messages";

export type AiProviderName = "openai" | "anthropic" | "gemini";

export type AiRoutingStrategy = "balanced" | "cost" | "latency" | "quality";

export type AiTaskType = "rag-chat" | "summarization" | "classification" | "agent";

export type AiModelProfile = {
  provider: AiProviderName;
  model: string;
  displayName: string;
  qualityScore: number;
  latencyScore: number;
  estimatedInputCostPer1k: number;
  estimatedOutputCostPer1k: number;
  supportsStreaming: boolean;
  maxOutputTokens: number;
};

export type AiRouteRequest = {
  task: AiTaskType;
  strategy?: AiRoutingStrategy;
  preferredProvider?: AiProviderName;
  requireStreaming?: boolean;
};

export type AiRoutePlan = {
  selected: AiModelProfile;
  fallbacks: AiModelProfile[];
  strategy: AiRoutingStrategy;
  reason: string;
};

export type AiStreamRequest = AiRouteRequest & {
  messages: BaseMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiInvokeRequest = AiRouteRequest & {
  messages: BaseMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiStreamResult = {
  stream: AsyncIterable<unknown>;
  route: AiRoutePlan;
};

export type AiInvokeResult = {
  content: unknown;
  route: AiRoutePlan;
};
