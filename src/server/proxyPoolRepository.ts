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
  public static upsertMany(items: { id: string; host: string; port: number; label?: string; source: string }[]): void {
    const db = Db.get();
    const stmt = db.prepare(`
      INSERT INTO proxies (id, host, port, label, source, createdAt)
      VALUES (@id, @host, @port, @label, @source, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        host=excluded.host,
        port=excluded.port,
        label=excluded.label,
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
      SELECT p.id, p.host, p.port, p.label, p.source,
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
}
