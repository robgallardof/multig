import { NextResponse } from "next/server";
import { WebshareSyncService } from "../../../../src/server/webshareSyncService";
import { LogRepository } from "../../../../src/server/logRepository";

/**
 * POST /api/proxies/sync
 *
 * Manual sync: downloads proxy list from Webshare API and stores it in SQLite.
 * Supports ordering/search via body query params (optional).
 *
 * Body:
 * { page_size?: number, ordering?: string, search?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { page_size?: number; ordering?: string; search?: string };

  const pageSize = Math.min(Number(body.page_size || 100), 200);
  const ordering = body.ordering || "country_code";
  const search = body.search || undefined;
  try {
    const res = await WebshareSyncService.sync({
      pageSize,
      ordering,
      search,
    });

    LogRepository.info("Webshare proxies synced", { imported: res.imported, ordering, search });
    return NextResponse.json({ ok: true, imported: res.imported });
  } catch (e: any) {
    LogRepository.error("Webshare proxies sync failed", String(e?.message || e), { ordering, search });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
