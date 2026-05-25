import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

  if (isAdminRoute(req)) {
    await auth.protect((has) => has({ role: "org:admin" }));
    return;
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
