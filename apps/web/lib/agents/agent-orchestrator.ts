import { env } from "@/lib/env";
import { AgentPlanner, toToolCall } from "@/lib/agents/agent-planner";
import { createDefaultToolRegistry } from "@/lib/agents/tools/default-tool-registry";
import type { AgentRunInput, AgentRunResult, AgentStep } from "@/lib/agents/types";
import type { ToolRegistry } from "@/lib/agents/tools/tool-registry";
import { telemetry } from "@/lib/observability/telemetry";

export class AgentOrchestrator {
  constructor(
    private readonly registry: ToolRegistry = createDefaultToolRegistry(),
    private readonly planner = new AgentPlanner(),
  ) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const maxSteps = input.maxSteps ?? env.AGENT_MAX_STEPS;
    const tools = this.registry.allowed(input.allowedTools);
    const steps: AgentStep[] = [];
    const startedAt = Date.now();

    for (let step = 1; step <= maxSteps; step += 1) {
      const decision = await this.planner.decide({
        task: input.task,
        tools,
        steps,
      });

      if (decision.type === "final") {
        steps.push({
          step,
          thought: decision.thought,
        });

        await telemetry.captureEvent({
          organizationId: input.organizationId,
          userId: input.userId,
          category: "agent",
          name: "agent.completed",
          latencyMs: Date.now() - startedAt,
          metadata: {
            steps: steps.length,
            toolCount: steps.filter((item) => item.toolCall).length,
          },
        });

        return {
          answer: decision.answer,
          steps,
          model: { source: "agent-planner" },
        };
      }

      const toolCall = toToolCall(decision);

      if (!toolCall) {
        steps.push({
          step,
          thought: "Planner returned an unusable tool call.",
        });
        break;
      }

      const toolResult = await this.registry.execute(toolCall.tool, toolCall.input, {
        organizationId: input.organizationId,
        userId: input.userId,
        conversationId: input.conversationId,
      });

      steps.push({
        step,
        thought: decision.thought,
        toolCall,
        toolResult,
      });

      await telemetry.captureEvent({
        organizationId: input.organizationId,
        userId: input.userId,
        category: "tool",
        name: `tool.${toolCall.tool}.${toolResult.ok ? "completed" : "failed"}`,
        level: toolResult.ok ? "info" : "warning",
        latencyMs: toolResult.latencyMs,
        metadata: {
          step,
          input: toolCall.input,
          error: toolResult.error,
        },
      });
    }

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      category: "agent",
      name: "agent.max_steps_reached",
      level: "warning",
      latencyMs: Date.now() - startedAt,
      metadata: { steps: steps.length, maxSteps },
    });

    return {
      answer:
        "I reached the maximum number of agent steps before producing a final answer. Review the tool trace for partial results.",
      steps,
      model: { source: "agent-planner", maxSteps },
    };
  }
}
