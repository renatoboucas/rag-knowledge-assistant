import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

export const runtime = "nodejs";

const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  status: z.enum(["PENDING", "PROCESSING", "INDEXED", "FAILED", "ARCHIVED"]).optional(),
  tags: z.array(z.string().trim().min(1).max(48)).max(24).optional(),
  collection: z.string().trim().max(80).nullable().optional(),
  customMetadata: z.record(z.unknown()).optional(),
});

function metadataObject(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function inputJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  if (!can(context.workspace.role, "knowledge:write")) {
    return NextResponse.json({ message: "Missing required permission." }, { status: 403 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "document.update",
    resource: "api.documents",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const { documentId } = await params;
  const payload = updateDocumentSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { message: "Invalid document update.", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: context.workspace.id,
      deletedAt: null,
    },
  });

  if (!document) {
    return NextResponse.json({ message: "Document not found." }, { status: 404 });
  }

  const currentMetadata = metadataObject(document.metadata);
  const nextMetadata = inputJsonObject({
    ...currentMetadata,
    ...(payload.data.tags ? { tags: payload.data.tags } : {}),
    ...(payload.data.collection !== undefined
      ? { collection: payload.data.collection || null }
      : {}),
    ...(payload.data.customMetadata ? { custom: payload.data.customMetadata } : {}),
  });

  const updated = await prisma.document.update({
    where: {
      id: document.id,
      organizationId: context.workspace.id,
    },
    data: {
      ...(payload.data.title ? { title: payload.data.title } : {}),
      ...(payload.data.status ? { status: payload.data.status } : {}),
      metadata: nextMetadata,
    },
  });

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "document.update",
    resource: "document",
    resourceId: document.id,
    request,
    metadata: payload.data,
  });

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  if (!can(context.workspace.role, "knowledge:write")) {
    return NextResponse.json({ message: "Missing required permission." }, { status: 403 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "knowledge:write",
    action: "document.delete",
    resource: "api.documents",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const { documentId } = await params;
  const deletedAt = new Date();

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: context.workspace.id,
      deletedAt: null,
    },
  });

  if (!document) {
    return NextResponse.json({ message: "Document not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.embedding.updateMany({
      where: {
        organizationId: context.workspace.id,
        chunk: { documentId: document.id },
        deletedAt: null,
      },
      data: { deletedAt },
    }),
    prisma.documentChunk.updateMany({
      where: {
        organizationId: context.workspace.id,
        documentId: document.id,
        deletedAt: null,
      },
      data: { deletedAt },
    }),
    prisma.document.update({
      where: {
        id: document.id,
        organizationId: context.workspace.id,
      },
      data: {
        status: "ARCHIVED",
        deletedAt,
      },
    }),
  ]);

  await auditLog.record({
    organizationId: context.workspace.id,
    userId: context.user.id,
    action: "document.delete",
    resource: "document",
    resourceId: document.id,
    request,
  });

  return NextResponse.json({ ok: true });
}
