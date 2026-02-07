import { NextResponse } from "next/server";
import { ProxyAssignmentService } from "../../../../../src/server/proxyAssignmentService";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";

/**
 * POST /api/profiles/:id/release-proxy
 *
 * @since 2026-01-23
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    ProxyAssignmentService.release(id);
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
