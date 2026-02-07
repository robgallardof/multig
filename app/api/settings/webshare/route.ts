import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";

/**
 * Returns a safe public view for the UI (no secrets).
 *
 * @since 2026-01-23
 */
function toPublic(settings: AppSettings) {
  const token = settings.webshare?.token || "";
  const hasToken = token.length > 0;
  const maskedToken = hasToken ? `…${token.slice(-4)}` : "";

  const hasCreds = !!((settings.webshare?.username || "") && (settings.webshare?.password || ""));

  return {
    configured: hasToken || hasCreds,
    hasToken,
    maskedToken,
    hasCreds,
    username: settings.webshare?.username || "",
  };
}

/**
 * GET /api/settings/webshare
 *
 * Returns: { configured, hasToken, maskedToken, hasCreds, username }
 *
 * @since 2026-01-23
 */
export async function GET() {
  const settings = await SettingsRepository.load();
  return NextResponse.json(toPublic(settings));
}

/**
 * POST /api/settings/webshare
 *
 * Body: { token?: string, username?: string, password?: string }
 * - Empty values clear the field.
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; username?: string; password?: string };

  const token = (body.token || "").trim() || undefined;
  const username = (body.username || "").trim() || undefined;
  const password = (body.password || "").trim() || undefined;

  const settings = await SettingsRepository.load();
  settings.webshare = {
    token,
    username,
    password,
  };

  await SettingsRepository.save(settings);
  return NextResponse.json(toPublic(settings));
}

/**
 * DELETE /api/settings/webshare
 *
 * Clears webshare settings only.
 *
 * @since 2026-01-23
 */
export async function DELETE() {
  const settings = await SettingsRepository.load();
  settings.webshare = undefined;
  await SettingsRepository.save(settings);
  return NextResponse.json(toPublic(settings));
}
