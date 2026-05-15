import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { LlmOrchestrator } from "@/lib/ai/llm-orchestrator";
import { modelMessageContent } from "@/lib/ai/message-content";
import type { AgentStep, AgentToolCall, ToolDefinition } from "@/lib/agents/types";

type PlannerDecision =
  | {
      type: "tool_call";
      thought: string;
      tool: string;
      input: unknown;
    }
  | {
      type: "final";
      thought: string;
      answer: string;
    };

function safeJsonParse(value: string): PlannerDecision | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start < 0 || end < start) {
    return null;
  }

  try {
    return JSON.parse(value.slice(start, end + 1)) as PlannerDecision;
  } catch {
    return null;
  }
}

function toolPrompt(tools: ToolDefinition[]) {
  return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n");
}

export class AgentPlanner {
  constructor(private readonly llm = new LlmOrchestrator()) {}

  async decide(input: {
    task: string;
    tools: ToolDefinition[];
    steps: AgentStep[];
  }): Promise<PlannerDecision> {
    const response = await this.llm.invoke({
      task: "agent",
      strategy: "quality",
      temperature: 0,
      maxOutputTokens: 1400,
      messages: [
        new SystemMessage(
          [
            "You are an enterprise AI agent planner.",
            "You may call one tool per step, or provide a final answer.",
            "Use tools for facts, calculations, retrieval, web context, or file analysis.",
            "Never claim tool results that are not present in the transcript.",
            "Return only JSON.",
            "",
            "Tool-call JSON:",
            '{"type":"tool_call","thought":"why this tool is needed","tool":"tool_name","input":{}}',
            "",
            "Final JSON:",
            '{"type":"final","thought":"why enough evidence is available","answer":"final answer"}',
            "",
            "Available tools:",
            toolPrompt(input.tools),
          ].join("\n"),
        ),
        new HumanMessage(
          [
            `Task: ${input.task}`,
            "",
            "Prior steps:",
            input.steps.length ? JSON.stringify(input.steps, null, 2) : "none",
          ].join("\n"),
        ),
      ],
    });

    const decision = safeJsonParse(modelMessageContent(response.content));

    if (!decision) {
      return {
        type: "final",
        thought: "The planner did not return a valid tool decision.",
        answer: modelMessageContent(response.content),
      };
    }

    return decision;
  }
}

export function toToolCall(decision: PlannerDecision): AgentToolCall | undefined {
  if (decision.type !== "tool_call") {
    return undefined;
  }

  return {
    tool: decision.tool,
    input: decision.input,
    reasoning: decision.thought,
  };
}
