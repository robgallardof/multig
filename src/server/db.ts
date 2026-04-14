import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { AppPaths } from "./paths";

type SqlParams = Record<string, unknown> | unknown[] | unknown;

type SqlStatement = {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

export type SqliteDb = {
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
  pragma(sql: string): void;
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult;
};

const require = createRequire(import.meta.url);

function normalizeParams(params: unknown[]): SqlParams {
  if (params.length === 0) return [];
  if (params.length === 1) return params[0] as SqlParams;
  return params;
}

function createNodeSqliteAdapter(db: any): SqliteDb {
  return {
    prepare(sql: string): SqlStatement {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]) {
          return stmt.run(normalizeParams(params));
        },
        get(...params: unknown[]) {
          return stmt.get(normalizeParams(params));
        },
        all(...params: unknown[]) {
          return stmt.all(normalizeParams(params)) as unknown[];
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    pragma(sql: string): void {
      db.exec(`PRAGMA ${sql}`);
    },
    transaction<TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult,
    ): (...args: TArgs) => TResult {
      return (...args: TArgs) => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const result = fn(...args);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      };
    },
  };
}

function createBetterSqliteAdapter(db: any): SqliteDb {
  return {
    prepare(sql: string): SqlStatement {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]) {
          return stmt.run(...params);
        },
        get(...params: unknown[]) {
          return stmt.get(...params);
        },
        all(...params: unknown[]) {
          return stmt.all(...params) as unknown[];
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    pragma(sql: string): void {
      db.pragma(sql);
    },
    transaction<TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult,
    ): (...args: TArgs) => TResult {
      return db.transaction(fn);
    },
  };
}

function shortErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.split("\n")[0] ?? error.message;
  return String(error);
}

function openDatabase(dbPath: string): SqliteDb {
  const errors: string[] = [];

  try {
    const sqlite = require("node:sqlite") as { DatabaseSync: new (path: string) => any };
    const db = new sqlite.DatabaseSync(dbPath);
    return createNodeSqliteAdapter(db);
  } catch (error) {
    errors.push(`node:sqlite -> ${shortErrorMessage(error)}`);
  }

  try {
    const BetterSqlite3 = require("better-sqlite3") as new (path: string) => any;
    const db = new BetterSqlite3(dbPath);
    return createBetterSqliteAdapter(db);
  } catch (error) {
    errors.push(`better-sqlite3 -> ${shortErrorMessage(error)}`);
  }

  throw new Error(
    `No SQLite driver available for ${process.platform}-${process.arch} Node ${process.version}. ${errors.join(" | ")}`,
  );
}

/**
 * SQLite database wrapper (server-only).
 *
 * SRP: database connection + migrations only.
 *
 * @since 2026-01-23
 */
export class Db {
  private static _db: SqliteDb | null = null;

  /**
   * Returns a singleton database connection.
   *
   * @since 2026-01-23
   */
  public static get(): SqliteDb {
    if (Db._db) return Db._db;

    const dir = AppPaths.dataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const dbPath = path.join(dir, "app.db");
    if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, "a"));

    const db = openDatabase(dbPath);

    // Pragmas (safe defaults)
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    Db._db = db;
    Db.migrate(db);
    return db;
  }

  /**
   * Runs schema migrations (idempotent).
   *
   * @since 2026-01-23
   */
  private static migrate(db: SqliteDb): void {
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
