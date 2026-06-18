import { Db } from "./db";

export type ProxyPoolItem = {
  id: string;
  host: string;
  port: number;
  label?: string;
  source: string;
  countryCode?: string;
  cityName?: string;
};

export type ProxyReconcileResult = {
  imported: number;
  removed: number;
  releasedProfileIds: string[];
};

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
  public static upsertMany(items: ProxyPoolItem[]): void {
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
   * Replaces one provider's local pool with a complete remote snapshot.
   * Foreign-key cascades release profiles that referenced proxies removed
   * from the provider account.
   */
  public static reconcileSource(source: string, items: ProxyPoolItem[]): ProxyReconcileResult {
    const db = Db.get();
    const existing = db
      .prepare("SELECT id FROM proxies WHERE source = ?")
      .all(source) as Array<{ id: string }>;
    const incomingIds = new Set(items.map((item) => item.id));
    const staleIds = existing
      .map((row) => String(row.id))
      .filter((id) => !incomingIds.has(id));

    const releasedProfileIds: string[] = [];
    const upsert = db.prepare(`
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
    const assignment = db.prepare("SELECT profileId FROM proxy_assignments WHERE proxyId = ?");
    const remove = db.prepare("DELETE FROM proxies WHERE id = ? AND source = ?");
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      for (const item of items) {
        upsert.run({
          id: item.id,
          host: item.host,
          port: item.port,
          label: item.label ?? null,
          countryCode: item.countryCode ?? null,
          cityName: item.cityName ?? null,
          source,
          createdAt: now,
        });
      }

      for (const id of staleIds) {
        const row = assignment.get(id) as { profileId?: string } | undefined;
        if (row?.profileId) releasedProfileIds.push(String(row.profileId));
        remove.run(id, source);
      }
    });
    tx();

    return {
      imported: items.length,
      removed: staleIds.length,
      releasedProfileIds,
    };
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
      where.push("(p.unavailableUntil IS NULL OR p.unavailableUntil <= @now)");
      params.now = new Date().toISOString();
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
        AND (p.unavailableUntil IS NULL OR p.unavailableUntil <= @now)
      ORDER BY RANDOM()
      LIMIT 1
    `).get({ now: new Date().toISOString() }) as any;

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
        AND (p.unavailableUntil IS NULL OR p.unavailableUntil <= @now)
    `).get({ now: new Date().toISOString() }) as any;

    return {
      total: Number(totalRow?.total || 0),
      available: Number(availableRow?.total || 0),
    };
  }

  public static exists(id: string): boolean {
    const row = Db.get().prepare("SELECT 1 AS found FROM proxies WHERE id = ?").get(id) as
      | { found?: number }
      | undefined;
    return row?.found === 1;
  }

  public static markUnavailable(id: string, error: string, cooldownMs = 10 * 60_000): void {
    const checkedAt = new Date();
    const unavailableUntil = new Date(checkedAt.getTime() + cooldownMs);
    Db.get().prepare(`
      UPDATE proxies
      SET unavailableUntil = ?, lastError = ?, lastCheckedAt = ?
      WHERE id = ?
    `).run(unavailableUntil.toISOString(), error.slice(0, 500), checkedAt.toISOString(), id);
  }

  public static markHealthy(id: string): void {
    Db.get().prepare(`
      UPDATE proxies
      SET unavailableUntil = NULL, lastError = NULL, lastCheckedAt = ?
      WHERE id = ?
    `).run(new Date().toISOString(), id);
  }
}
