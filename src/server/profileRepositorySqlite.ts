import crypto from "node:crypto";
import { Db } from "./db";
import type { Profile } from "./profileTypes";

/**
 * SQLite-backed profile repository.
 *
 * SRP: profile persistence only.
 *
 * @since 2026-01-23
 */
export class ProfileRepositorySqlite {
  /**
   * Lists profiles (alphabetical).
   *
   * @since 2026-01-23
   */
  public static list(): Profile[] {
    const db = Db.get();
    const rows = db.prepare("SELECT * FROM profiles ORDER BY name COLLATE NOCASE ASC").all() as any[];
    return rows.map(ProfileRepositorySqlite.mapRow);
  }

  /**
   * Gets a profile by id.
   *
   * @since 2026-01-23
   */
  public static getById(id: string): Profile | null {
    const db = Db.get();
    const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id) as any;
    return row ? ProfileRepositorySqlite.mapRow(row) : null;
  }

  /**
   * Creates a profile.
   *
   * @since 2026-01-23
   */
  public static create(input: Omit<Profile, "id"> & { id?: string }): Profile[] {
    const db = Db.get();
    const id = input.id || crypto.randomUUID();
    const osType = input.osType ?? "windows";

    db.prepare(`
      INSERT INTO profiles (id, name, icon, url, osType, proxyServer, proxyUsername, proxyPassword, createdAt, lastOpenedAt)
      VALUES (@id, @name, @icon, @url, @osType, @proxyServer, @proxyUsername, @proxyPassword, @createdAt, @lastOpenedAt)
    `).run({
      id,
      name: input.name,
      icon: input.icon,
      url: input.url ?? null,
      osType,
      proxyServer: null,
      proxyUsername: null,
      proxyPassword: null,
      createdAt: input.createdAt,
      lastOpenedAt: (input as any).lastOpenedAt ?? null,
    });

    return ProfileRepositorySqlite.list();
  }

  /**
   * Creates multiple profiles in a single transaction.
   *
   * @since 2026-01-23
   */
  public static createMany(inputs: Array<Omit<Profile, "id"> & { id?: string }>): Profile[] {
    if (inputs.length === 0) return ProfileRepositorySqlite.list();
    const db = Db.get();
    const stmt = db.prepare(`
      INSERT INTO profiles (id, name, icon, url, osType, proxyServer, proxyUsername, proxyPassword, createdAt, lastOpenedAt)
      VALUES (@id, @name, @icon, @url, @osType, @proxyServer, @proxyUsername, @proxyPassword, @createdAt, @lastOpenedAt)
    `);
    const insert = db.transaction((rows: Array<Omit<Profile, "id"> & { id?: string }>) => {
      for (const row of rows) {
        const id = row.id || crypto.randomUUID();
        const osType = row.osType ?? "windows";
        stmt.run({
          id,
          name: row.name,
          icon: row.icon,
          url: row.url ?? null,
          osType,
          proxyServer: null,
          proxyUsername: null,
          proxyPassword: null,
          createdAt: row.createdAt,
          lastOpenedAt: (row as any).lastOpenedAt ?? null,
        });
      }
    });
    insert(inputs);
    return ProfileRepositorySqlite.list();
  }

  /**
   * Updates a profile.
   *
   * @since 2026-01-23
   */
  public static update(id: string, patch: Partial<Profile>): Profile[] {
    const db = Db.get();
    const current = ProfileRepositorySqlite.getById(id);
    if (!current) throw new Error("Profile not found.");

    const next: any = { ...current, ...patch };
    if (!next.osType) next.osType = "windows";

    db.prepare(`
      UPDATE profiles
      SET name=@name, icon=@icon, url=@url, osType=@osType,
          proxyServer=NULL, proxyUsername=NULL, proxyPassword=NULL,
          createdAt=@createdAt, lastOpenedAt=@lastOpenedAt
      WHERE id=@id
    `).run({
      id,
      name: next.name,
      icon: next.icon,
      url: next.url ?? null,
      osType: next.osType ?? "windows",
      createdAt: next.createdAt,
      lastOpenedAt: next.lastOpenedAt ?? null,
    });

    return ProfileRepositorySqlite.list();
  }

  /**
   * Deletes profile (and cascades assignment).
   *
   * @since 2026-01-23
   */
  public static delete(id: string): Profile[] {
    const db = Db.get();
    db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
    return ProfileRepositorySqlite.list();
  }

  private static mapRow(r: any): Profile {
    return {
      id: String(r.id),
      name: String(r.name),
      icon: String(r.icon),
      url: r.url ? String(r.url) : undefined,
      osType: r.osType ? String(r.osType) as Profile["osType"] : "windows",
      createdAt: String(r.createdAt),
      lastOpenedAt: r.lastOpenedAt ? String(r.lastOpenedAt) : undefined,
    };
  }
}
