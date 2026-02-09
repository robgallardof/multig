import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";

/**
 * Returns the settings view for the UI.
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
    password: settings.webshare?.password || "",
    token,
  };
}

/**
 * GET /api/settings/webshare
 *
 * Returns: { configured, hasToken, maskedToken, hasCreds, username, password, token }
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
 * - Empty values keep current values (use DELETE to clear).
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; username?: string; password?: string };

  const settings = await SettingsRepository.load();
  const current = settings.webshare || {};
  const tokenInput = body.token;
  const usernameInput = body.username;
  const passwordInput = body.password;

  const token = tokenInput === undefined ? current.token : (tokenInput.trim() || current.token);
  const username = usernameInput === undefined ? current.username : (usernameInput.trim() || current.username);
  const password = passwordInput === undefined ? current.password : (passwordInput.trim() || current.password);

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
