import type { ToolDefinition, ToolExecutionContext, ToolResult } from "@/lib/agents/types";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register<TTool extends ToolDefinition>(tool: TTool) {
    this.tools.set(tool.name, tool);
    return this;
  }

  list() {
    return [...this.tools.values()];
  }

  allowed(names?: string[]) {
    if (!names?.length) {
      return this.list();
    }

    const allowed = new Set(names);
    return this.list().filter((tool) => allowed.has(tool.name));
  }

  describe(names?: string[]) {
    return this.allowed(names).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.describe(`Input schema for ${tool.name}`).toString(),
    }));
  }

  async execute(name: string, input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const startedAt = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        ok: false,
        toolName: name,
        output: null,
        error: `Unknown tool: ${name}`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const parsed = tool.parameters.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        toolName: name,
        output: null,
        error: JSON.stringify(parsed.error.flatten().fieldErrors),
        latencyMs: Date.now() - startedAt,
      };
    }

    try {
      return {
        ok: true,
        toolName: name,
        output: await tool.execute(parsed.data, context),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        toolName: name,
        output: null,
        error: error instanceof Error ? error.message : "Tool execution failed.",
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}
