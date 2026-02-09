import { NextResponse, type NextRequest } from "next/server";

const ACCESS_PATH = "/access";
const ACCESS_API_PATH = "/api/access";

async function hasValidToken(request: NextRequest): Promise<boolean> {
  const headerToken = request.headers.get("x-access-token")?.trim();
  const cookieToken = request.cookies.get("multig_access_token")?.value;
  const token = headerToken || cookieToken;
  if (!token) {
    return false;
  }

  const url = new URL(ACCESS_API_PATH, request.nextUrl.origin);
  const response = await fetch(url, {
    method: headerToken ? "POST" : "GET",
    cache: "no-store",
    headers: {
      ...(headerToken
        ? { "content-type": "application/json" }
        : { cookie: request.headers.get("cookie") ?? "" }),
    },
    body: headerToken ? JSON.stringify({ token: headerToken }) : undefined,
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json().catch(() => null)) as { authorized?: boolean } | null;
  return Boolean(data?.authorized);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith(ACCESS_PATH) ||
    pathname.startsWith("/api/access") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (await hasValidToken(request)) {
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
