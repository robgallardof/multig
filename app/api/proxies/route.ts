import { NextResponse } from "next/server";
import { ProxyPoolRepository } from "../../../src/server/proxyPoolRepository";

/**
 * GET /api/proxies
 * Query:
 * - available=1 -> only free proxies
 * - search=...  -> text filter (host/label/port)
 * - limit=...   -> max results (default 200)
 *
 * @since 2026-01-23
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const availableOnly = url.searchParams.get("available") === "1";
  const search = url.searchParams.get("search") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

  const items = ProxyPoolRepository.list({ availableOnly, search, limit });
  return NextResponse.json({ items });
}
