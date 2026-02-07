import { NextResponse } from "next/server";
import { ProfileRepositorySqlite } from "../../../../src/server/profileRepositorySqlite";

function sanitize(p: any) {
  const { proxyPassword, ...rest } = p;
  return { ...rest, hasProxy: !!(p.proxyServer && (p.proxyUsername || p.proxyPassword)) };
}


/**
 * PATCH /api/profiles/:id
 * Body: { name?: string, icon?: string, url?: string|null }
 *
 * @since 2026-01-23
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; icon?: string; url?: string | null; proxyServer?: string | null; proxyUsername?: string | null; proxyPassword?: string | null };

  const patch: any = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.icon === "string") patch.icon = body.icon.trim();
  if (body.url === null) patch.url = undefined;
  if (typeof body.url === "string") patch.url = body.url.trim() || undefined;

if (body.proxyServer === null) patch.proxyServer = undefined;
if (typeof body.proxyServer === "string") patch.proxyServer = body.proxyServer.trim() || undefined;

if (body.proxyUsername === null) patch.proxyUsername = undefined;
if (typeof body.proxyUsername === "string") patch.proxyUsername = body.proxyUsername.trim() || undefined;

// Password: if null => clear; if "" => keep existing (client can omit or send empty).
if (body.proxyPassword === null) patch.proxyPassword = undefined;
if (typeof body.proxyPassword === "string" && body.proxyPassword.length > 0) patch.proxyPassword = body.proxyPassword;

  const profiles = ProfileRepositorySqlite.update(id, patch as any);
  return NextResponse.json({ profiles: profiles.map(sanitize) });
}

/**
 * DELETE /api/profiles/:id
 *
 * @since 2026-01-23
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profiles = ProfileRepositorySqlite.delete(id);
  return NextResponse.json({ profiles: profiles.map(sanitize) });
}