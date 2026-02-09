import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findAccessToken } from "../../../src/server/accessTokens";

const COOKIE_NAME = "multig_access_token";

export async function GET() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const match = findAccessToken(token);
  return NextResponse.json({ authorized: Boolean(match), device: match?.device ?? null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  const match = findAccessToken(token);

  if (!match) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  cookies().set(COOKIE_NAME, match.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return NextResponse.json({ authorized: true, device: match.device });
}
