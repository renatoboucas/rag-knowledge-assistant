import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { embeddingQueue } from "@/lib/embeddings/queue/embedding-queue";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = await getSessionContext();
  const { documentId } = await params;

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "embedding.enqueue",
    resource: "api.embeddings",
    rateLimit: "ai",
  });

  if (guard) {
    return guard;
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: context.workspace.id,
      deletedAt: null,
    },
    include: {
      chunks: {
        where: { deletedAt: null },
        take: 1,
      },
    },
  });

  if (!document) {
    return NextResponse.json({ message: "Document not found." }, { status: 404 });
  }

  if (!document.chunks.length) {
    return NextResponse.json({ message: "Document has no chunks to embed." }, { status: 409 });
  }

  embeddingQueue.enqueue({
    organizationId: context.workspace.id,
    documentId,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "embedding.enqueue",
    resource: "document",
    resourceId: documentId,
    request,
  });

  return NextResponse.json({ id: documentId, status: "queued" }, { status: 202 });
}

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:read",
    action: "embedding.queue.read",
    resource: "api.embeddings",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  return NextResponse.json({
    queue: embeddingQueue.snapshot().filter((job) => job.organizationId === context.workspace?.id),
  });
}
