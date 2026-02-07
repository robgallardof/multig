import { NextResponse } from "next/server";
import { ProxyAssignmentService } from "../../../../../src/server/proxyAssignmentService";
import { ProfileRepositorySqlite } from "../../../../../src/server/profileRepositorySqlite";

/**
 * POST /api/profiles/:id/assign-proxy
 * Body: { proxyId: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { proxyId?: string };
  const proxyId = String(body.proxyId || "").trim();
  if (!proxyId) return NextResponse.json({ error: "proxyId is required" }, { status: 400 });

  try {
    ProxyAssignmentService.assign(id, proxyId);
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
