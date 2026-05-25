import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluationService } from "@/lib/evaluations";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const caseSchema = z.object({
  query: z.string().trim().min(3),
  expectedAnswer: z.string().trim().optional(),
  expectedCitationIds: z.array(z.string().min(1)).default([]),
  expectedDocuments: z.array(z.string().min(1)).default([]),
  requiredKeywords: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const datasetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  cases: z.array(caseSchema).min(1).max(200),
});

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "evaluations:read",
    action: "evaluations.datasets.read",
    resource: "api.evaluations.datasets",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const datasets = await evaluationService.listDatasets(context.workspace.id);

  return NextResponse.json({ datasets });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "evaluations:write",
    action: "evaluations.datasets.create",
    resource: "api.evaluations.datasets",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = datasetSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid benchmark dataset.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dataset = await evaluationService.createDataset({
    organizationId: context.workspace.id,
    ...parsed.data,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "evaluations.datasets.create",
    resource: "evaluation_dataset",
    resourceId: dataset.id,
    request,
    metadata: { cases: dataset.cases.length },
  });

  return NextResponse.json({ dataset }, { status: 201 });
}
