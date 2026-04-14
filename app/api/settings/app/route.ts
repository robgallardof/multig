import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";
import { AppConfig } from "../../../../src/server/appConfig";

type AppSettingsPublic = {
  language: "es" | "en";
  addonUrl: string;
  defaultUrl: string;
  wplaceBotConfigured: boolean;
  wplaceImagesCount: number;
  wplaceLocalStorage: Record<string, string>;
  serialActivated: boolean;
  wplaceScriptUrl: string;
};

const DEFAULT_URL = "https://www.kinggallardo.dev";

function toPublic(settings: AppSettings): AppSettingsPublic {
  const localStorage = settings.wplaceLocalStorage || {};
  const imageCount = Object.values(localStorage).reduce((count, value) => {
    try {
      const parsed = JSON.parse(value) as any;
      if (Array.isArray(parsed?.images)) return count + parsed.images.length;
    } catch {
      return count;
    }
    return count;
  }, 0);
  return {
    language: settings.language === "en" ? "en" : "es",
    addonUrl: (settings.addonUrl || "").trim(),
    defaultUrl: (settings.defaultUrl || DEFAULT_URL).trim() || DEFAULT_URL,
    wplaceBotConfigured: Boolean(settings.wplaceBotStorage) || Object.keys(localStorage).length > 0,
    wplaceImagesCount: imageCount,
    wplaceLocalStorage: localStorage,
    serialActivated: settings.serialActivated === true,
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
 * Body: { language?: "es" | "en", addonUrl?: string, defaultUrl?: string, wplaceBotStorage?: string | null, wplaceLocalStorage?: Record<string,string> | null, serialActivated?: boolean }
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
    wplaceLocalStorage?: Record<string, string> | null;
    serialActivated?: boolean;
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
  const wplaceLocalStorage = body.wplaceLocalStorage && typeof body.wplaceLocalStorage === "object"
    ? Object.fromEntries(
      Object.entries(body.wplaceLocalStorage).filter(
        ([key, value]) => typeof key === "string" && key.trim() && typeof value === "string" && value.trim()
      ).map(([key, value]) => [key.trim(), value.trim()])
    )
    : body.wplaceLocalStorage === null
      ? {}
      : settings.wplaceLocalStorage || {};
  const serialActivated = typeof body.serialActivated === "boolean"
    ? body.serialActivated
    : settings.serialActivated === true;

  settings.language = language;
  settings.addonUrl = addonUrl || undefined;
  settings.defaultUrl = defaultUrl || DEFAULT_URL;
  settings.wplaceBotStorage = wplaceBotStorage || undefined;
  settings.wplaceLocalStorage = Object.keys(wplaceLocalStorage).length ? wplaceLocalStorage : undefined;
  settings.serialActivated = serialActivated || undefined;
  await SettingsRepository.save(settings);

  return NextResponse.json(toPublic(settings));
}
