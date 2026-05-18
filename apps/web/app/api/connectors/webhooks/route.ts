import { NextResponse } from "next/server";
import { z } from "zod";

import { connectorSyncQueue } from "@/lib/connectors/jobs/connector-sync-queue";
import { connectorService } from "@/lib/connectors/services/connector-service";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { workflowQueue } from "@/lib/workflows/jobs/workflow-queue";
import { workflowService } from "@/lib/workflows/services/workflow-service";

export const runtime = "nodejs";

const webhookSchema = z.object({
  organizationId: z.string().min(1),
  connectorId: z.string().min(1),
  provider: z.enum(["GOOGLE_DRIVE", "NOTION", "CONFLUENCE", "SLACK", "GITHUB"]),
  payload: z.unknown().optional(),
});

export async function POST(request: Request) {
  if (env.CONNECTOR_WEBHOOK_SECRET) {
    const provided = request.headers.get("x-connector-webhook-secret");

    if (provided !== env.CONNECTOR_WEBHOOK_SECRET) {
      return NextResponse.json({ message: "Invalid webhook secret." }, { status: 401 });
    }
  }

  const parsed = webhookSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid webhook payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const connector = await prisma.connector.findFirst({
    where: {
      id: parsed.data.connectorId,
      organizationId: parsed.data.organizationId,
      provider: parsed.data.provider,
      deletedAt: null,
      isEnabled: true,
    },
  });

  if (!connector) {
    return NextResponse.json({ message: "Connector not found." }, { status: 404 });
  }

  await connectorService.recordWebhook(parsed.data.organizationId, parsed.data.connectorId);
  const job = await connectorService.createSyncJob(
    parsed.data.organizationId,
    parsed.data.connectorId,
    "webhook",
  );
  connectorSyncQueue.enqueue({
    jobId: job.id,
    connectorId: job.connectorId,
    organizationId: job.organizationId,
  });
  const workflowRuns = await workflowService.triggerMatching(
    parsed.data.organizationId,
    "CONNECTOR_WEBHOOK",
    {
      connectorId: parsed.data.connectorId,
      provider: parsed.data.provider,
      connectorSyncJobId: job.id,
    },
  );

  for (const run of workflowRuns) {
    workflowQueue.enqueue({
      runId: run.id,
      workflowId: run.workflowId,
      organizationId: run.organizationId,
    });
  }

  return NextResponse.json(
    { accepted: true, jobId: job.id, workflowRuns: workflowRuns.length },
    { status: 202 },
  );
}
