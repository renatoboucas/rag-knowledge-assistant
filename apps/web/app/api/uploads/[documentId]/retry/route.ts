import { NextResponse } from "next/server";

import { DocumentRepository } from "@/lib/db/repositories/document-repository";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";
import { uploadQueue } from "@/lib/uploads/queue/upload-queue";

export const runtime = "nodejs";

function uploadMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const upload = (metadata as { upload?: unknown }).upload;

  if (!upload || typeof upload !== "object") {
    return null;
  }

  return upload as { filename?: string; storageKey?: string; size?: number; checksum?: string };
}

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
    action: "document.retry_upload",
    resource: "api.uploads.retry",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: context.workspace.id,
      sourceType: "UPLOAD",
      deletedAt: null,
    },
  });

  if (!document) {
    return NextResponse.json({ message: "Upload not found." }, { status: 404 });
  }

  const metadata = uploadMetadata(document.metadata);
  const storageKey = metadata?.storageKey ?? document.sourceUri;
  const filename = metadata?.filename ?? document.title;

  if (!storageKey) {
    return NextResponse.json(
      { message: "Upload does not have a stored file to retry." },
      { status: 409 },
    );
  }

  const documents = new DocumentRepository(prisma);
  await documents.updateDocumentProcessingState(
    { organizationId: context.workspace.id },
    document.id,
    {
      status: "PENDING",
      errorMessage: null,
      metadata: {
        upload: {
          ...metadata,
          storageKey,
          filename,
          phase: "queued",
          progress: 10,
        },
      },
    },
  );

  uploadQueue.enqueue({
    documentId: document.id,
    organizationId: context.workspace.id,
    createdById: context.user.id,
    storageKey,
    absolutePath: storageKey,
    filename,
    mimeType: document.mimeType ?? "application/octet-stream",
    sourceType: "UPLOAD",
    size: metadata?.size,
    checksum: metadata?.checksum ?? document.checksum ?? undefined,
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "document.retry_upload",
    resource: "document",
    resourceId: document.id,
    request,
  });

  return NextResponse.json({ id: document.id, status: "PENDING" });
}
