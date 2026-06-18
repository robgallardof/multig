import { ProxyPoolRepository } from "./proxyPoolRepository";
import { WebshareClient } from "./webshareClient";

export type WebshareSyncResult = {
  imported: number;
  removed: number;
  releasedProfileIds: string[];
  complete: boolean;
  skipped?: boolean;
};

/**
 * Webshare proxy sync service.
 *
 * SRP: download from Webshare API + persist in SQLite pool.
 *
 * @since 2026-01-23
 */
export class WebshareSyncService {
  private static lastSuccessAt = 0;
  private static lastResult: WebshareSyncResult | null = null;
  private static inFlight: Promise<WebshareSyncResult> | null = null;

  /**
   * Refreshes the provider pool at most once per freshness window and shares
   * one request among concurrent profile launches.
   */
  public static async ensureFresh(options?: { maxAgeMs?: number }): Promise<WebshareSyncResult> {
    const maxAgeMs = Math.max(0, Number(options?.maxAgeMs ?? 60_000));
    if (
      WebshareSyncService.lastResult
      && Date.now() - WebshareSyncService.lastSuccessAt < maxAgeMs
    ) {
      return { ...WebshareSyncService.lastResult, skipped: true };
    }
    if (WebshareSyncService.inFlight) return WebshareSyncService.inFlight;

    WebshareSyncService.inFlight = WebshareSyncService.sync().finally(() => {
      WebshareSyncService.inFlight = null;
    });
    return WebshareSyncService.inFlight;
  }

  /**
   * Syncs proxies from Webshare into the local pool.
   *
   * @since 2026-01-23
   */
  public static async sync(options?: {
    pageSize?: number;
    ordering?: string;
    search?: string;
    maxPages?: number;
  }): Promise<WebshareSyncResult> {
    const pageSize = Math.max(1, Math.min(Number(options?.pageSize || 100), 200));
    const ordering = options?.ordering || "country_code";
    const search = options?.search || undefined;
    const maxPages = Math.max(1, Math.min(Number(options?.maxPages || 100), 100));

    const all: any[] = [];
    let page = 1;
    let hasMore = false;

    while (page <= maxPages) {
      const res = await WebshareClient.listProxies({
        page: String(page),
        page_size: String(pageSize),
        ordering,
        search,
      });

      for (const it of res.results) all.push(it);
      hasMore = Boolean(res.next);
      if (!hasMore) break;
      page += 1;
    }

    const mapped = all.filter((x: any) => x.valid !== false).map((x: any) => {
      const id = x.id || `${x.host}:${x.port}`;
      const labelParts = [x.country_code, x.city_name].filter(Boolean);
      const label = labelParts.length ? `${labelParts.join(" / ")} • ${x.host}:${x.port}` : `${x.host}:${x.port}`;
      return {
        id: String(id),
        host: String(x.host),
        port: Number(x.port),
        label,
        countryCode: x.country_code ? String(x.country_code) : undefined,
        cityName: x.city_name ? String(x.city_name) : undefined,
        source: "webshare",
      };
    });

    const complete = !hasMore && !search;
    const result = complete
      ? ProxyPoolRepository.reconcileSource("webshare", mapped)
      : (() => {
          ProxyPoolRepository.upsertMany(mapped);
          return { imported: mapped.length, removed: 0, releasedProfileIds: [] as string[] };
        })();

    const syncResult: WebshareSyncResult = { ...result, complete };
    WebshareSyncService.lastSuccessAt = Date.now();
    WebshareSyncService.lastResult = syncResult;
    return syncResult;
  }
}
