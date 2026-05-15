import { NextResponse } from "next/server";
import { z } from "zod";

import { AgentOrchestrator } from "@/lib/agents/agent-orchestrator";
import { getSessionContext } from "@/lib/session";
import { telemetry } from "@/lib/observability/telemetry";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const agentRunSchema = z.object({
  task: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  maxSteps: z.number().int().positive().max(12).optional(),
  allowedTools: z
    .array(z.enum(["web_search", "knowledge_retrieval", "calculator", "file_analysis"]))
    .optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const parsed = agentRunSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid agent payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:read",
    action: "agent.run",
    resource: "api.agents.run",
    rateLimit: "ai",
    prompt: parsed.data.task,
  });

  if (guard) {
    return guard;
  }

  try {
    const result = await new AgentOrchestrator().run({
      organizationId: context.workspace.id,
      userId: context.user.id,
      conversationId: parsed.data.conversationId,
      task: parsed.data.task,
      maxSteps: parsed.data.maxSteps,
      allowedTools: parsed.data.allowedTools,
    });

    await auditLog.record({
      organizationId: context.workspace.id,
      userId: context.user.id,
      action: "agent.run",
      resource: "agent",
      request,
      metadata: { steps: result.steps.length, allowedTools: parsed.data.allowedTools },
    });

    return NextResponse.json(result);
  } catch (error) {
    await telemetry.captureError(error, {
      organizationId: context.workspace.id,
      userId: context.user.id,
      name: "api.agent.failed",
    });

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Agent run failed." },
      { status: 500 },
    );
  }
}
