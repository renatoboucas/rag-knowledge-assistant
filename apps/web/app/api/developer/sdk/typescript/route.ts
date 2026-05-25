import { NextResponse } from "next/server";

import { typescriptSdkSource } from "@/lib/developer";

export const runtime = "nodejs";

export async function GET() {
  return new NextResponse(typescriptSdkSource(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
