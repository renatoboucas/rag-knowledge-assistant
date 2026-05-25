import { NextResponse } from "next/server";

import { publicApiOpenApiSpec } from "@/lib/developer";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(publicApiOpenApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
