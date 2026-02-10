import { NextResponse } from "next/server";
import { ProxyAssignmentService } from "../../../../../src/server/proxyAssignmentService";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../../../src/server/profilePresenter";
import { LogRepository } from "../../../../../src/server/logRepository";
import { ProcessRegistry } from "../../../../../src/server/processRegistry";

/**
 * POST /api/profiles/:id/release-proxy
 *
 * @since 2026-01-23
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const stopped = ProcessRegistry.stop(id);
    ProxyAssignmentService.release(id);
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles: listPublicProfiles(profiles), stopped });
  } catch (e: any) {
    LogRepository.error("Proxy release failed", String(e?.message || e), { profileId: id });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
