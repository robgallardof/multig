import { NextResponse } from "next/server";
import { ProfileRepositorySqlite } from "../../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../../src/server/profilePresenter";


/**
 * PATCH /api/profiles/:id
 * Body: { name?: string, icon?: string, url?: string|null, osType?: string }
 *
 * @since 2026-01-23
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; icon?: string; url?: string | null; osType?: string };

  const patch: any = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.icon === "string") patch.icon = body.icon.trim();
  if (body.url === null) patch.url = undefined;
  if (typeof body.url === "string") patch.url = body.url.trim() || undefined;
  if (body.osType === "windows" || body.osType === "mac" || body.osType === "linux") patch.osType = body.osType;

  const profiles = ProfileRepositorySqlite.update(id, patch as any);
  return NextResponse.json({ profiles: listPublicProfiles(profiles) });
}

/**
 * DELETE /api/profiles/:id
 *
 * @since 2026-01-23
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profiles = ProfileRepositorySqlite.delete(id);
  return NextResponse.json({ profiles: listPublicProfiles(profiles) });
}
