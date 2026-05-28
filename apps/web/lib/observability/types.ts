export type ObservabilityCategory =
  | "ai"
  | "retrieval"
  | "agent"
  | "tool"
  | "voice"
  | "error"
  | "user"
  | "performance";

export type ObservabilityLevel = "debug" | "info" | "warning" | "error";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type CaptureEventInput = {
  organizationId?: string;
  userId?: string;
  category: ObservabilityCategory;
  name: string;
  level?: ObservabilityLevel;
  traceId?: string;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
  estimatedCost?: number;
  latencyMs?: number;
  metadata?: unknown;
};

export type TraceInput = {
  id: string;
  name: string;
  runType: "chain" | "llm" | "retriever" | "tool";
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
};
