import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "multig_access_token";

export async function GET() {
  return NextResponse.json({ authorized: true, device: null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  const cookieStore = await cookies();
  if (token) {
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return NextResponse.json({ authorized: true, device: null });
}
