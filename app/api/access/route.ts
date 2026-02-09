import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findAccessToken } from "../../../src/server/accessTokens";

const COOKIE_NAME = "multig_access_token";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const match = await findAccessToken(token);
  return NextResponse.json({ authorized: Boolean(match), device: match?.device ?? null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  const match = await findAccessToken(token);

  if (!match) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, match.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return NextResponse.json({ authorized: true, device: match.device });
}
