import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../../src/server/settingsRepository";
import type { AppSettings } from "../../../../src/server/settingsTypes";

type AppSettingsPublic = {
  language: "es" | "en";
  addonUrl: string;
};

function toPublic(settings: AppSettings): AppSettingsPublic {
  return {
    language: settings.language === "en" ? "en" : "es",
    addonUrl: (settings.addonUrl || "").trim(),
  };
}

/**
 * GET /api/settings/app
 *
 * Returns: { language, addonUrl }
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
 * Body: { language?: "es" | "en", addonUrl?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const settings = await SettingsRepository.load();
  const body = (await req.json().catch(() => ({}))) as { language?: "es" | "en"; addonUrl?: string };
  const language = body.language === "en" ? "en" : body.language === "es" ? "es" : settings.language ?? "es";
  const addonUrl = typeof body.addonUrl === "string" ? body.addonUrl.trim() : settings.addonUrl || "";

  settings.language = language;
  settings.addonUrl = addonUrl || undefined;
  await SettingsRepository.save(settings);

  return NextResponse.json(toPublic(settings));
}
