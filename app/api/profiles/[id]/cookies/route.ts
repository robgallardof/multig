import { NextResponse } from "next/server";
import path from "node:path";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";
import { AppPaths } from "../../../../../src/server/paths";
import { LogRepository } from "../../../../../src/server/logRepository";
import { exportProfileCookies, importProfileCookies } from "../../../../../src/server/cookiesIo";

type CookiesPayload = { cookies: unknown[] };

/**
 * GET /api/profiles/:id/cookies
 * Exports cookies for a profile.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) {
    LogRepository.warn("Cookies export for unknown profile", undefined, { profileId: id });
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  const profileDir = path.join(AppPaths.profilesDir(), id);

  try {
    const cookies = exportProfileCookies(profileDir);
    LogRepository.info("Cookies exported", { profileId: id, count: cookies.length });
    return NextResponse.json({ cookies });
  } catch (e: any) {
    LogRepository.error("Cookies export failed", String(e?.message || e), { profileId: id });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

/**
 * POST /api/profiles/:id/cookies
 * Imports cookies for a profile.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) {
    LogRepository.warn("Cookies import for unknown profile", undefined, { profileId: id });
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  let payload: CookiesPayload;
  try {
    payload = (await req.json()) as CookiesPayload;
  } catch {
    LogRepository.warn("Cookies import invalid JSON payload", undefined, { profileId: id });
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.cookies || !Array.isArray(payload.cookies)) {
    LogRepository.warn("Cookies import payload missing cookies array", undefined, { profileId: id });
    return NextResponse.json({ error: "cookies must be an array" }, { status: 400 });
  }

  const profileDir = path.join(AppPaths.profilesDir(), id);

  try {
    importProfileCookies(profileDir, payload.cookies);
    LogRepository.info("Cookies imported", { profileId: id, count: payload.cookies.length });
    return NextResponse.json({ ok: true, imported: payload.cookies.length });
  } catch (e: any) {
    LogRepository.error("Cookies import failed", String(e?.message || e), { profileId: id });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
