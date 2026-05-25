import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { withPublicApi } from "@/lib/developer";
import { RetrievalEngine } from "@/lib/rag/services/retrieval-engine";

export const runtime = "nodejs";

const retrievalSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  mode: z.enum(["semantic", "hybrid"]).default("hybrid"),
  limit: z.number().int().min(1).max(20).default(8),
  minSimilarity: z.number().min(0).max(1).optional(),
  metadataFilter: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = retrievalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withPublicApi(
    request,
    { scope: "retrieval:read", route: "public.retrieval" },
    async (context) => {
      const retrieval = await new RetrievalEngine().retrieve({
        organizationId: context.organization.id,
        query: parsed.data.query,
        mode: parsed.data.mode,
        limit: parsed.data.limit,
        minSimilarity: parsed.data.minSimilarity,
        metadataFilter: parsed.data.metadataFilter as Prisma.InputJsonObject | undefined,
        enableMultiQuery: true,
        enableQueryDecomposition: true,
      });

      return NextResponse.json({
        query: retrieval.query,
        contextText: retrieval.contextText,
        citations: retrieval.citations,
        evaluation: retrieval.evaluation,
      });
    },
  );
}
