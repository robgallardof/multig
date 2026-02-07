import { NextResponse } from "next/server";
import { WebshareClient } from "../../../../src/server/webshareClient";

/**
 * GET /api/webshare/proxies
 *
 * Pass-through query params supported by Webshare:
 * - page, page_size
 * - ordering
 * - search
 * - plus any filters (status, etc.)
 *
 * @since 2026-01-23
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string | undefined> = {};

  // Copy all query params, but keep them as simple strings.
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  try {
    const data = await WebshareClient.listProxies(params);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
