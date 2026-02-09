import { NextResponse } from "next/server";
import { ProxyAssignmentService } from "../../../../../src/server/proxyAssignmentService";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../../../src/server/profilePresenter";
import { LogRepository } from "../../../../../src/server/logRepository";

/**
 * POST /api/profiles/:id/assign-proxy
 * Body: { proxyId?: string, mode?: "random" }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { proxyId?: string; mode?: string };
  const proxyId = String(body.proxyId || "").trim();

  try {
    const profile = ProfileRepositorySqlite.getById(id);
    if (!profile) {
      return NextResponse.json({ error: "profile not found" }, { status: 404 });
    }
    if (profile.useProxy === false) {
      return NextResponse.json({ error: "proxy disabled for profile" }, { status: 400 });
    }
    if (proxyId) {
      ProxyAssignmentService.assign(id, proxyId);
    } else {
      ProxyAssignmentService.assignRandom(id, { force: body.mode === "random" });
    }
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles: listPublicProfiles(profiles) });
  } catch (e: any) {
    LogRepository.error("Proxy assign failed", String(e?.message || e), { profileId: id, proxyId, mode: body.mode });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
