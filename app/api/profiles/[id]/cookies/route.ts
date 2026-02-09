import { NextResponse } from "next/server";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";
import { AppPaths } from "../../../../../src/server/paths";
import { PythonSetup } from "../../../../../src/server/pythonSetup";

type CookiesPayload = { cookies: unknown[] };

function runCookieTool(action: "import" | "export", profileDir: string, input?: string): string {
  const py = PythonSetup.python();
  const args = [AppPaths.cookiesIoPy(), "--profile", profileDir, "--action", action];
  const result = spawnSync(py, args, {
    input,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || "Cookie import/export failed.");
  }

  return result.stdout || "";
}

/**
 * GET /api/profiles/:id/cookies
 * Exports cookies for a profile.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  const profileDir = path.join(AppPaths.profilesDir(), id);

  try {
    const out = runCookieTool("export", profileDir);
    const cookies = out ? (JSON.parse(out) as unknown[]) : [];
    return NextResponse.json({ cookies });
  } catch (e: any) {
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
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  let payload: CookiesPayload;
  try {
    payload = (await req.json()) as CookiesPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.cookies || !Array.isArray(payload.cookies)) {
    return NextResponse.json({ error: "cookies must be an array" }, { status: 400 });
  }

  const profileDir = path.join(AppPaths.profilesDir(), id);

  try {
    runCookieTool("import", profileDir, JSON.stringify(payload.cookies));
    return NextResponse.json({ ok: true, imported: payload.cookies.length });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
