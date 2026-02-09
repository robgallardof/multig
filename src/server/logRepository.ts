import { Db } from "./db";

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  id: number;
  level: LogLevel;
  message: string;
  detail?: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

export type LogListFilters = {
  level?: LogLevel;
  search?: string;
  limit?: number;
};

/**
 * SQLite-backed log repository.
 *
 * SRP: logging persistence only.
 *
 * @since 2026-01-23
 */
export class LogRepository {
  public static info(message: string, context?: Record<string, unknown>) {
    LogRepository.safeAdd({ level: "info", message, context });
  }

  public static warn(message: string, detail?: string, context?: Record<string, unknown>) {
    LogRepository.safeAdd({ level: "warn", message, detail, context });
  }

  public static error(message: string, detail?: string, context?: Record<string, unknown>) {
    LogRepository.safeAdd({ level: "error", message, detail, context });
  }

  public static list(filters: LogListFilters = {}): LogEntry[] {
    const db = Db.get();
    const limit = Math.min(filters.limit ?? 200, 500);
    const where: string[] = [];
    const params: Record<string, unknown> = { limit };

    if (filters.level) {
      where.push("level = @level");
      params.level = filters.level;
    }

    if (filters.search) {
      where.push("(message LIKE @search OR detail LIKE @search OR context LIKE @search)");
      params.search = `%${filters.search}%`;
    }

    const query = `
      SELECT id, level, message, detail, context, createdAt
      FROM logs
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY datetime(createdAt) DESC, id DESC
      LIMIT @limit
    `;

    const rows = db.prepare(query).all(params) as any[];
    return rows.map((row) => LogRepository.mapRow(row));
  }

  public static add(entry: Omit<LogEntry, "id" | "createdAt"> & { createdAt?: string }): void {
    const db = Db.get();
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const context = entry.context ? JSON.stringify(entry.context) : null;

    db.prepare(`
      INSERT INTO logs (level, message, detail, context, createdAt)
      VALUES (@level, @message, @detail, @context, @createdAt)
    `).run({
      level: entry.level,
      message: entry.message,
      detail: entry.detail ?? null,
      context,
      createdAt,
    });
  }

  private static safeAdd(entry: Omit<LogEntry, "id" | "createdAt"> & { createdAt?: string }): void {
    try {
      LogRepository.add(entry);
    } catch {
      // ignore logging failures to prevent cascading errors
    }
  }

  private static mapRow(row: any): LogEntry {
    let context: Record<string, unknown> | undefined;
    if (row.context) {
      try {
        context = JSON.parse(String(row.context)) as Record<string, unknown>;
      } catch {
        context = { raw: String(row.context) };
      }
    }

    return {
      id: Number(row.id),
      level: row.level as LogLevel,
      message: String(row.message),
      detail: row.detail ? String(row.detail) : undefined,
      context,
      createdAt: String(row.createdAt),
    };
  }
}
