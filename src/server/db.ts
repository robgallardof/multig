import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { AppPaths } from "./paths";

/**
 * SQLite database wrapper (server-only).
 *
 * SRP: database connection + migrations only.
 *
 * @since 2026-01-23
 */
export class Db {
  private static _db: Database.Database | null = null;

  /**
   * Returns a singleton database connection.
   *
   * @since 2026-01-23
   */
  public static get(): Database.Database {
    if (Db._db) return Db._db;

    const dir = AppPaths.dataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const dbPath = path.join(dir, "app.db");
    const db = new Database(dbPath);

    // Pragmas (safe defaults)
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");

    Db._db = db;
    Db.migrate(db);
    return db;
  }

  /**
   * Runs schema migrations (idempotent).
   *
   * @since 2026-01-23
   */
  private static migrate(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        url TEXT NULL,
        osType TEXT NULL,
        useProxy INTEGER NOT NULL DEFAULT 1,
        proxyServer TEXT NULL,
        proxyUsername TEXT NULL,
        proxyPassword TEXT NULL,
        createdAt TEXT NOT NULL,
        lastOpenedAt TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS proxies (
        id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        label TEXT NULL,
        countryCode TEXT NULL,
        cityName TEXT NULL,
        source TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS proxy_assignments (
        profileId TEXT NOT NULL UNIQUE,
        proxyId TEXT NOT NULL UNIQUE,
        assignedAt TEXT NOT NULL,
        PRIMARY KEY (profileId),
        FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (proxyId) REFERENCES proxies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_proxies_source ON proxies(source);

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT NULL,
        context TEXT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_logs_createdAt ON logs(createdAt);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    const tableInfo = (name: string) => db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
    const hasColumn = (table: string, column: string) =>
      tableInfo(table).some((row) => row.name === column);

    if (!hasColumn("profiles", "osType")) {
      db.exec("ALTER TABLE profiles ADD COLUMN osType TEXT NULL");
    }
    if (!hasColumn("profiles", "useProxy")) {
      db.exec("ALTER TABLE profiles ADD COLUMN useProxy INTEGER NOT NULL DEFAULT 1");
    }

    if (!hasColumn("proxies", "countryCode")) {
      db.exec("ALTER TABLE proxies ADD COLUMN countryCode TEXT NULL");
    }

    if (!hasColumn("proxies", "cityName")) {
      db.exec("ALTER TABLE proxies ADD COLUMN cityName TEXT NULL");
    }
  }
}
