import { NextResponse } from "next/server";
import { ProxyPoolRepository } from "../../../../src/server/proxyPoolRepository";

/**
 * GET /api/proxies/status
 * Returns: { total, available }
 *
 * @since 2026-01-23
 */
export async function GET() {
  const counts = ProxyPoolRepository.counts();
  return NextResponse.json(counts);
}
