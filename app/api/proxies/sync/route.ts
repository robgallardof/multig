import { NextResponse } from "next/server";
import { WebshareClient } from "../../../../src/server/webshareClient";
import { ProxyPoolRepository } from "../../../../src/server/proxyPoolRepository";

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

  // Fetch first N pages (manual sync, keep it safe vs rate limits)
  const all: any[] = [];
  let page = 1;

  while (page <= 10) {
    const res = await WebshareClient.listProxies({
      page: String(page),
      page_size: String(pageSize),
      ordering,
      search,
    });

    for (const it of res.results) all.push(it);
    if (!res.next) break;
    page += 1;
  }

  const mapped = all.map((x: any) => {
    const id = x.id || `${x.host}:${x.port}`;
    const labelParts = [x.country_code, x.city_name].filter(Boolean);
    const label = labelParts.length ? `${labelParts.join(" / ")} • ${x.host}:${x.port}` : `${x.host}:${x.port}`;
    return { id: String(id), host: String(x.host), port: Number(x.port), label, source: "webshare" };
  });

  ProxyPoolRepository.upsertMany(mapped);

  return NextResponse.json({ ok: true, imported: mapped.length });
}
