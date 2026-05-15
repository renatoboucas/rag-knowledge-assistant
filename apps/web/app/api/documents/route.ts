import { NextResponse } from "next/server";
import type { DocumentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getSessionContext } from "@/lib/session";

export const runtime = "nodejs";

type DocumentMetadata = {
  tags?: unknown;
  collection?: unknown;
  upload?: { size?: unknown; filename?: unknown };
};

function metadataOf(metadata: Prisma.JsonValue): DocumentMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as DocumentMetadata;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function GET(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  if (!can(context.workspace.role, "knowledge:read")) {
    return NextResponse.json({ message: "Missing required permission." }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status") as DocumentStatus | null;
  const tag = url.searchParams.get("tag")?.trim().toLowerCase() ?? "";
  const collection = url.searchParams.get("collection")?.trim().toLowerCase() ?? "";

  const documents = await prisma.document.findMany({
    where: {
      organizationId: context.workspace.id,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  const retrievalStats = await prisma.retrievalLog.groupBy({
    by: ["documentId"],
    where: {
      organizationId: context.workspace.id,
      deletedAt: null,
      documentId: { not: null },
    },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const statsByDocument = new Map(
    retrievalStats
      .filter((stat) => stat.documentId)
      .map((stat) => [
        stat.documentId,
        {
          retrievalCount: stat._count._all,
          lastRetrievedAt: stat._max.createdAt,
        },
      ]),
  );

  const mapped = documents.map((document) => {
    const metadata = metadataOf(document.metadata);
    const tags = stringArray(metadata.tags);
    const documentCollection = stringValue(metadata.collection);
    const uploadSize = numberValue(metadata.upload?.size);
    const stats = statsByDocument.get(document.id);

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
      tags,
      collection: documentCollection,
      size: uploadSize,
      metadata: document.metadata,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      retrievalCount: stats?.retrievalCount ?? 0,
      lastRetrievedAt: stats?.lastRetrievedAt ?? null,
    };
  });

  const filtered = mapped.filter((document) => {
    const haystack = [
      document.title,
      document.sourceUri,
      document.mimeType,
      document.status,
      document.collection,
      ...document.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) {
      return false;
    }

    if (tag && !document.tags.some((item) => item.toLowerCase() === tag)) {
      return false;
    }

    if (collection && document.collection?.toLowerCase() !== collection) {
      return false;
    }

    return true;
  });

  const tagCounts = new Map<string, number>();
  const collectionCounts = new Map<string, number>();

  for (const document of mapped) {
    for (const item of document.tags) {
      tagCounts.set(item, (tagCounts.get(item) ?? 0) + 1);
    }

    if (document.collection) {
      collectionCounts.set(
        document.collection,
        (collectionCounts.get(document.collection) ?? 0) + 1,
      );
    }
  }

  return NextResponse.json({
    documents: filtered,
    analytics: {
      total: mapped.length,
      indexed: mapped.filter((document) => document.status === "INDEXED").length,
      processing: mapped.filter((document) => document.status === "PROCESSING").length,
      failed: mapped.filter((document) => document.status === "FAILED").length,
      archived: mapped.filter((document) => document.status === "ARCHIVED").length,
      retrievals: mapped.reduce((total, document) => total + document.retrievalCount, 0),
      tokens: mapped.reduce((total, document) => total + document.tokenCount, 0),
    },
    facets: {
      tags: [...tagCounts.entries()].map(([name, count]) => ({ name, count })),
      collections: [...collectionCounts.entries()].map(([name, count]) => ({ name, count })),
    },
  });
}
