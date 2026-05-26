import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicApiRoute = createRouteMatcher([
  "/api/public(.*)",
  "/api/developer/openapi(.*)",
  "/api/developer/sdk(.*)",
]);
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);
const isAdminRoute = createRouteMatcher([
  "/dashboard/admin(.*)",
  "/api/admin(.*)",
  "/dashboard/members(.*)",
  "/api/organizations/invitations(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) {
    return;
  }

  try {
    if (isAdminRoute(req)) {
      await auth.protect((has) => has({ role: "org:admin" }));
      return;
    }

    if (isProtectedRoute(req)) {
      await auth.protect();
    }
  } catch (error) {
    console.error("Middleware auth protection failed", error);

    if (req.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard(.*)", "/api/((?!public|developer/openapi|developer/sdk).*)", "/trpc(.*)"],
};
