import { NextResponse, type NextRequest } from "next/server";
import { isAccessTokenValid } from "./src/server/accessTokens";

const ACCESS_PATH = "/access";

function hasValidToken(request: NextRequest): boolean {
  const headerToken = request.headers.get("x-access-token");
  const cookieToken = request.cookies.get("multig_access_token")?.value;
  return isAccessTokenValid(headerToken || cookieToken);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith(ACCESS_PATH) ||
    pathname.startsWith("/api/access") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (hasValidToken(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = ACCESS_PATH;
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
