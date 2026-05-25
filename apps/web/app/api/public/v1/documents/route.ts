import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withPublicApi } from "@/lib/developer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withPublicApi(
    request,
    { scope: "documents:read", route: "public.documents.list" },
    async (context) => {
      const url = new URL(request.url);
      const query = url.searchParams.get("query")?.trim();
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
      const documents = await prisma.document.findMany({
        where: {
          organizationId: context.organization.id,
          deletedAt: null,
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { sourceUri: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          sourceType: true,
          sourceUri: true,
          metadata: true,
          tokenCount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ documents });
    },
  );
}
