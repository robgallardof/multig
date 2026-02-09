import { NextResponse } from "next/server";
import { LogRepository, type LogLevel } from "../../../src/server/logRepository";

type LogPayload = {
  level?: LogLevel;
  message?: string;
  detail?: string;
  context?: Record<string, unknown>;
};

/**
 * GET /api/logs
 * Query params: level?, search?, limit?
 *
 * @since 2026-01-23
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const level = url.searchParams.get("level") as LogLevel | null;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit") || "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;

  const logs = LogRepository.list({
    level: level === "info" || level === "warn" || level === "error" ? level : undefined,
    search,
    limit,
  });

  return NextResponse.json({ logs });
}

/**
 * POST /api/logs
 * Body: { level: "info"|"warn"|"error", message: string, detail?: string, context?: object }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  let body: LogPayload;
  try {
    body = (await req.json()) as LogPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const level = body.level ?? "info";
  const message = body.message ? String(body.message).trim() : "";
  const detail = body.detail ? String(body.detail).trim() : undefined;
  const context = body.context ?? undefined;

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (level !== "info" && level !== "warn" && level !== "error") {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  LogRepository.add({ level, message, detail, context });
  return NextResponse.json({ ok: true });
}
