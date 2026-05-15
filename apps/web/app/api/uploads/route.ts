import { NextResponse } from "next/server";

import { DocumentRepository } from "@/lib/db/repositories/document-repository";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { uploadQueue } from "@/lib/uploads/queue/upload-queue";
import { localStorageProvider } from "@/lib/uploads/storage/local-storage-provider";
import type { UploadHistoryItem } from "@/lib/uploads/types/upload";
import { validateUploadFile } from "@/lib/uploads/validation/file-validation";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

function uploadMetadata(document: { metadata: unknown }) {
  if (!document.metadata || typeof document.metadata !== "object") {
    return {};
  }

  return document.metadata as {
    upload?: { size?: number; checksum?: string; storageKey?: string };
  };
}

export async function GET() {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: {
      organizationId: context.workspace.id,
      sourceType: "UPLOAD",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const items: UploadHistoryItem[] = documents.map((document) => {
    const metadata = uploadMetadata(document);

    return {
      id: document.id,
      title: document.title,
      status: document.status,
      sourceType: document.sourceType,
      sourceUri: document.sourceUri,
      mimeType: document.mimeType,
      chunkCount: document.chunkCount,
      tokenCount: document.tokenCount,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      size: metadata.upload?.size,
      checksum: metadata.upload?.checksum,
    };
  });

  return NextResponse.json({ items, queue: uploadQueue.snapshot() });
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "document.upload",
    resource: "api.uploads",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (!files.length) {
    return NextResponse.json({ message: "At least one file is required." }, { status: 400 });
  }

  const documents = new DocumentRepository(prisma);
  const accepted = [];
  const rejected = [];

  for (const file of files) {
    const validation = validateUploadFile(file);

    if (!validation.ok) {
      rejected.push({ filename: file.name, reason: validation.reason });
      continue;
    }

    const document = await documents.createDocument({
      organizationId: context.workspace.id,
      createdById: context.user.id,
      title: file.name,
      sourceType: "UPLOAD",
      mimeType: validation.mimeType,
      status: "PENDING",
      metadata: {
        upload: {
          filename: file.name,
          size: file.size,
          phase: "received",
          progress: 5,
        },
      },
    });

    const stored = await localStorageProvider.put({
      organizationId: context.workspace.id,
      documentId: document.id,
      file,
    });

    const updated = await prisma.document.update({
      where: { id: document.id, organizationId: context.workspace.id },
      data: {
        sourceUri: stored.storageKey,
        checksum: stored.checksum,
        metadata: {
          upload: {
            filename: file.name,
            storageKey: stored.storageKey,
            size: stored.size,
            checksum: stored.checksum,
            phase: "queued",
            progress: 10,
          },
        },
      },
    });

    uploadQueue.enqueue({
      documentId: updated.id,
      organizationId: context.workspace.id,
      createdById: context.user.id,
      storageKey: stored.storageKey,
      absolutePath: stored.absolutePath,
      filename: file.name,
      mimeType: validation.mimeType,
      sourceType: "UPLOAD",
      size: stored.size,
      checksum: stored.checksum,
    });

    accepted.push({
      id: updated.id,
      filename: file.name,
      status: updated.status,
      size: stored.size,
      checksum: stored.checksum,
    });
  }

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "document.upload",
    resource: "document",
    request,
    metadata: { accepted: accepted.length, rejected: rejected.length },
  });

  return NextResponse.json({ accepted, rejected }, { status: accepted.length ? 202 : 400 });
}
