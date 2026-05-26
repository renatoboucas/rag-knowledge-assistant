import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API_PREFIXES = ["/api/public", "/api/developer/openapi", "/api/developer/sdk"];

const CLERK_SESSION_COOKIES = ["__session", "__clerk_db_jwt", "__client"];

function hasSessionCookie(request: NextRequest) {
  return CLERK_SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicApi(pathname) || hasSessionCookie(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/dashboard(.*)", "/api/((?!public|developer/openapi|developer/sdk).*)", "/trpc(.*)"],
};
