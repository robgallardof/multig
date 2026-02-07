/**
 * Webshare API client (server-only).
 *
 * Notes:
 * - Auth uses: Authorization: Token <APIKEY>
 * - Supports pagination/filtering/ordering/search by passing query params through.
 * - This client returns ONLY safe fields to the UI. No passwords.
 *
 * @since 2026-01-23
 */
import type { WebshareSettings } from "./settingsTypes";
import { SettingsRepository } from "./settingsRepository";

export type WebshareProxyItem = {
  id: string;
  host: string;
  port: number;
  username?: string;
  // password is never returned to the UI
  country_code?: string;
  city_name?: string;
};

export type WebshareProxyListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebshareProxyItem[];
};

type RawProxy = any;

/**
 * Minimal in-memory cache to reduce rate-limit risk.
 *
 * @since 2026-01-23
 */
class WebshareCache {
  private static lastKey: string | null = null;
  private static lastAt = 0;
  private static lastValue: WebshareProxyListResponse | null = null;

  public static get(key: string): WebshareProxyListResponse | null {
    const now = Date.now();
    if (WebshareCache.lastKey === key && WebshareCache.lastValue && (now - WebshareCache.lastAt) < 15_000) {
      return WebshareCache.lastValue;
    }
    return null;
  }

  public static set(key: string, value: WebshareProxyListResponse): void {
    WebshareCache.lastKey = key;
    WebshareCache.lastAt = Date.now();
    WebshareCache.lastValue = value;
  }
}

export class WebshareClient {
  /**
   * Loads webshare settings and ensures token exists.
   *
   * @since 2026-01-23
   */
  private static async getSettings(): Promise<WebshareSettings> {
    const settings = await SettingsRepository.load();
    const ws = settings.webshare || {};
    if (!ws.token) {
      throw new Error("Webshare token is not configured.");
    }
    return ws;
  }

  /**
   * Lists proxies using Webshare API v2.
   * Supports query parameters:
   * - page, page_size, ordering, search, plus other filters supported by Webshare.
   *
   * @since 2026-01-23
   */
  public static async listProxies(query: Record<string, string | undefined>): Promise<WebshareProxyListResponse> {
    const ws = await WebshareClient.getSettings();

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && String(v).trim().length > 0) qs.set(k, String(v));
    }

    const key = qs.toString();
    const cached = WebshareCache.get(key);
    if (cached) return cached;

    const url = `https://proxy.webshare.io/api/v2/proxy/list/?${qs.toString()}`;

    const r = await fetch(url, {
      headers: {
        "Authorization": `Token ${ws.token}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (r.status === 429) {
      throw new Error("Webshare rate limit exceeded (429). Wait 60s and retry.");
    }
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Webshare error (${r.status}): ${body}`);
    }

    const raw = (await r.json()) as { count: number; next: string | null; previous: string | null; results: RawProxy[] };

    const results: WebshareProxyItem[] = (raw.results || []).map((x: any) => {
      // Webshare fields may vary by product; keep it resilient.
      const host = String(x.proxy_address || x.host || x.ip || "");
      const port = Number(x.port || x.proxy_port || 0);

      return {
        id: String(x.id ?? x.uuid ?? `${host}:${port}`),
        host,
        port,
        username: x.username ? String(x.username) : undefined,
        country_code: x.country_code ? String(x.country_code) : undefined,
        city_name: x.city_name ? String(x.city_name) : undefined,
      };
    }).filter(x => x.host && x.port);

    const out: WebshareProxyListResponse = {
      count: Number(raw.count || results.length),
      next: raw.next ?? null,
      previous: raw.previous ?? null,
      results,
    };

    WebshareCache.set(key, out);
    return out;
  }
}
