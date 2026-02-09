import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";

type AppSettingsPublic = {
  language: "es" | "en";
  addonUrl: string;
  defaultUrl: string;
};

const DEFAULT_URL = "https://www.robertogallardo.dev";

function toPublic(settings: AppSettings): AppSettingsPublic {
  return {
    language: settings.language === "en" ? "en" : "es",
    addonUrl: (settings.addonUrl || "").trim(),
    defaultUrl: (settings.defaultUrl || DEFAULT_URL).trim() || DEFAULT_URL,
  };
}

/**
 * GET /api/settings/app
 *
 * Returns: { language, addonUrl, defaultUrl }
 *
 * @since 2026-01-23
 */
export async function GET() {
  const settings = await SettingsRepository.load();
  return NextResponse.json(toPublic(settings));
}

/**
 * POST /api/settings/app
 *
 * Body: { language?: "es" | "en", addonUrl?: string, defaultUrl?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const settings = await SettingsRepository.load();
  const body = (await req.json().catch(() => ({}))) as { language?: "es" | "en"; addonUrl?: string; defaultUrl?: string };
  const language = body.language === "en" ? "en" : body.language === "es" ? "es" : settings.language ?? "es";
  const addonUrl = typeof body.addonUrl === "string" ? body.addonUrl.trim() : settings.addonUrl || "";
  const defaultUrl = typeof body.defaultUrl === "string"
    ? body.defaultUrl.trim()
    : settings.defaultUrl || DEFAULT_URL;

  settings.language = language;
  settings.addonUrl = addonUrl || undefined;
  settings.defaultUrl = defaultUrl || DEFAULT_URL;
  await SettingsRepository.save(settings);

  return NextResponse.json(toPublic(settings));
}
