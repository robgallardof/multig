import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import type { Profile } from "../../../src/server/profileTypes";

function sanitize(p: any) {
  const { proxyPassword, ...rest } = p;
  return { ...rest, hasProxy: !!(p.proxyServer && (p.proxyUsername || p.proxyPassword)) };
}

/**
 * GET /api/profiles
 *
 * @since 2026-01-23
 */
export async function GET() {
  try {
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles: profiles.map(sanitize) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}

/**
 * POST /api/profiles
 * Body: { name: string, icon: string, url?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; icon?: string; url?: string; proxyServer?: string; proxyUsername?: string; proxyPassword?: string };

    const name = body.name ? String(body.name).trim() : "";
    const icon = body.icon ? String(body.icon).trim() : "fox";
    const url = body.url ? String(body.url).trim() : undefined;

    const proxyServer = body.proxyServer ? String(body.proxyServer).trim() : undefined;
    const proxyUsername = body.proxyUsername ? String(body.proxyUsername).trim() : undefined;
    const proxyPassword = body.proxyPassword ? String(body.proxyPassword).trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: "name is required", profiles: [] }, { status: 400 });
    }

    const p: any = {
      id: crypto.randomUUID(),
      name,
      icon,
      url,
      createdAt: new Date().toISOString(),
      proxyServer,
      proxyUsername,
      proxyPassword,
    };

    const profiles = ProfileRepositorySqlite.create(p as any);
    const createdId = p.id;
    return NextResponse.json({ createdId, profiles: profiles.map(sanitize) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}
