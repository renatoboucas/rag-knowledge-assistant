import type { z } from "zod";

export type AgentScope = {
  organizationId: string;
  userId: string;
  conversationId?: string;
};

export type ToolExecutionContext = AgentScope & {
  abortSignal?: AbortSignal;
};

export type ToolResult = {
  ok: boolean;
  toolName: string;
  output: unknown;
  error?: string;
  latencyMs: number;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (input: z.output<z.ZodTypeAny>, context: ToolExecutionContext) => Promise<unknown>;
};

export type AgentToolCall = {
  tool: string;
  input: unknown;
  reasoning?: string;
};

export type AgentStep = {
  step: number;
  thought: string;
  toolCall?: AgentToolCall;
  toolResult?: ToolResult;
};

export type AgentRunInput = AgentScope & {
  task: string;
  maxSteps?: number;
  allowedTools?: string[];
};

export type AgentRunResult = {
  answer: string;
  steps: AgentStep[];
  model: unknown;
};
