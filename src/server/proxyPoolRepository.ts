import { Db } from "./db";

/**
 * Proxy pool repository (SQLite).
 *
 * SRP: proxies table persistence only.
 *
 * @since 2026-01-23
 */
export class ProxyPoolRepository {
  /**
   * Upserts proxies.
   *
   * @since 2026-01-23
   */
  public static upsertMany(items: {
    id: string;
    host: string;
    port: number;
    label?: string;
    source: string;
    countryCode?: string;
    cityName?: string;
  }[]): void {
    const db = Db.get();
    const stmt = db.prepare(`
      INSERT INTO proxies (id, host, port, label, countryCode, cityName, source, createdAt)
      VALUES (@id, @host, @port, @label, @countryCode, @cityName, @source, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        host=excluded.host,
        port=excluded.port,
        label=excluded.label,
        countryCode=excluded.countryCode,
        cityName=excluded.cityName,
        source=excluded.source
    `);

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      for (const it of items) {
        stmt.run({
          id: it.id,
          host: it.host,
          port: it.port,
          label: it.label ?? null,
          countryCode: it.countryCode ?? null,
          cityName: it.cityName ?? null,
          source: it.source,
          createdAt: now,
        });
      }
    });
    tx();
  }

  /**
   * Lists proxies. When availableOnly = true, returns only unassigned proxies.
   *
   * @since 2026-01-23
   */
  public static list(options: { availableOnly: boolean; search?: string; limit: number }): any[] {
    const db = Db.get();
    const q = (options.search || "").trim();

    const where = [];
    const params: any = { limit: options.limit };

    if (q) {
      where.push("(p.host LIKE @q OR p.label LIKE @q OR CAST(p.port AS TEXT) LIKE @q)");
      params.q = `%${q}%`;
    }

    let sql = `
      SELECT p.id, p.host, p.port, p.label, p.countryCode, p.cityName, p.source,
             a.profileId AS inUseBy
      FROM proxies p
      LEFT JOIN proxy_assignments a ON a.proxyId = p.id
    `;

    if (options.availableOnly) {
      where.push("a.profileId IS NULL");
    }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY p.label COLLATE NOCASE ASC, p.host ASC LIMIT @limit";

    return db.prepare(sql).all(params) as any[];
  }

  /**
   * Picks one random available proxy (unassigned).
   *
   * @since 2026-01-23
   */
  public static pickRandomAvailable(): {
    id: string;
    host: string;
    port: number;
    label?: string;
    source: string;
    countryCode?: string;
    cityName?: string;
  } | null {
    const db = Db.get();
    const row = db.prepare(`
      SELECT p.id, p.host, p.port, p.label, p.countryCode, p.cityName, p.source
      FROM proxies p
      LEFT JOIN proxy_assignments a ON a.proxyId = p.id
      WHERE a.profileId IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `).get() as any;

    if (!row) return null;
    return {
      id: String(row.id),
      host: String(row.host),
      port: Number(row.port),
      label: row.label ? String(row.label) : undefined,
      countryCode: row.countryCode ? String(row.countryCode) : undefined,
      cityName: row.cityName ? String(row.cityName) : undefined,
      source: String(row.source),
    };
  }

  /**
   * Returns proxy pool counts (total + available).
   *
   * @since 2026-01-23
   */
  public static counts(): { total: number; available: number } {
    const db = Db.get();
    const totalRow = db.prepare("SELECT COUNT(*) as total FROM proxies").get() as any;
    const availableRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM proxies p
      LEFT JOIN proxy_assignments a ON a.proxyId = p.id
      WHERE a.profileId IS NULL
    `).get() as any;

    return {
      total: Number(totalRow?.total || 0),
      available: Number(availableRow?.total || 0),
    };
  }
}
