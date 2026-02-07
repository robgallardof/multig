import { ProxyPoolRepository } from "./proxyPoolRepository";
import { WebshareClient } from "./webshareClient";

/**
 * Webshare proxy sync service.
 *
 * SRP: download from Webshare API + persist in SQLite pool.
 *
 * @since 2026-01-23
 */
export class WebshareSyncService {
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
  }): Promise<{ imported: number }> {
    const pageSize = Math.min(Number(options?.pageSize || 100), 200);
    const ordering = options?.ordering || "country_code";
    const search = options?.search || undefined;
    const maxPages = Math.min(Number(options?.maxPages || 10), 20);

    const all: any[] = [];
    let page = 1;

    while (page <= maxPages) {
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

    return { imported: mapped.length };
  }
}
