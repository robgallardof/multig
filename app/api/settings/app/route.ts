import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";
import { AppConfig } from "../../../../src/server/appConfig";

type AppSettingsPublic = {
  language: "es" | "en";
  addonUrl: string;
  defaultUrl: string;
  wplaceBotConfigured: boolean;
  wplaceScriptUrl: string;
};

const DEFAULT_URL = "https://www.robertogallardo.dev";

function toPublic(settings: AppSettings): AppSettingsPublic {
  return {
    language: settings.language === "en" ? "en" : "es",
    addonUrl: (settings.addonUrl || "").trim(),
    defaultUrl: (settings.defaultUrl || DEFAULT_URL).trim() || DEFAULT_URL,
    wplaceBotConfigured: Boolean(settings.wplaceBotStorage),
    wplaceScriptUrl: AppConfig.wplaceScriptUrl,
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
 * Body: { language?: "es" | "en", addonUrl?: string, defaultUrl?: string, wplaceBotStorage?: string | null }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const settings = await SettingsRepository.load();
  const body = (await req.json().catch(() => ({}))) as {
    language?: "es" | "en";
    addonUrl?: string;
    defaultUrl?: string;
    wplaceBotStorage?: string | null;
  };
  const language = body.language === "en" ? "en" : body.language === "es" ? "es" : settings.language ?? "es";
  const addonUrl = typeof body.addonUrl === "string" ? body.addonUrl.trim() : settings.addonUrl || "";
  const defaultUrl = typeof body.defaultUrl === "string"
    ? body.defaultUrl.trim()
    : settings.defaultUrl || DEFAULT_URL;
  const wplaceBotStorage = typeof body.wplaceBotStorage === "string"
    ? body.wplaceBotStorage.trim()
    : body.wplaceBotStorage === null
      ? ""
      : settings.wplaceBotStorage || "";

  settings.language = language;
  settings.addonUrl = addonUrl || undefined;
  settings.defaultUrl = defaultUrl || DEFAULT_URL;
  settings.wplaceBotStorage = wplaceBotStorage || undefined;
  await SettingsRepository.save(settings);

  return NextResponse.json(toPublic(settings));
}
