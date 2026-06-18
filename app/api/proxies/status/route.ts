import { NextResponse } from "next/server";
import { ProxyPoolRepository } from "../../../../src/server/proxyPoolRepository";
import { WebshareSyncService } from "../../../../src/server/webshareSyncService";
import { LogRepository } from "../../../../src/server/logRepository";

/**
 * GET /api/proxies/status
 * Returns: { total, available }
 *
 * @since 2026-01-23
 */
export async function GET() {
  let syncError: string | undefined;
  try {
    await WebshareSyncService.ensureFresh({ maxAgeMs: 5 * 60_000 });
  } catch (error: any) {
    syncError = String(error?.message || error);
    LogRepository.warn("Automatic Webshare status sync failed", syncError);
  }
  const counts = ProxyPoolRepository.counts();
  return NextResponse.json({ ...counts, syncError });
}
