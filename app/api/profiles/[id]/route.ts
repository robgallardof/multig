import { NextResponse } from "next/server";
import { ProfileRepositorySqlite } from "../../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../../src/server/profilePresenter";
import { LogRepository } from "../../../../src/server/logRepository";


/**
 * PATCH /api/profiles/:id
 * Body: { name?: string, icon?: string, url?: string|null, osType?: string }
 *
 * @since 2026-01-23
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; icon?: string; url?: string | null; osType?: string };

    const patch: any = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.icon === "string") patch.icon = body.icon.trim();
    if (body.url === null) patch.url = undefined;
    if (typeof body.url === "string") patch.url = body.url.trim() || undefined;
    if (body.osType === "windows" || body.osType === "mac" || body.osType === "linux") patch.osType = body.osType;

    const profiles = ProfileRepositorySqlite.update(id, patch as any);
    LogRepository.info("Profile updated", { profileId: id });
    return NextResponse.json({ profiles: listPublicProfiles(profiles) });
  } catch (e: any) {
    LogRepository.error("Profile update failed", String(e?.message || e), { profileId: id });
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/:id
 *
 * @since 2026-01-23
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const profiles = ProfileRepositorySqlite.delete(id);
    LogRepository.info("Profile deleted", { profileId: id });
    return NextResponse.json({ profiles: listPublicProfiles(profiles) });
  } catch (e: any) {
    LogRepository.error("Profile delete failed", String(e?.message || e), { profileId: id });
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}
