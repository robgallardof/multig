import { NextResponse } from "next/server";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { WebshareSyncService } from "../../../src/server/webshareSyncService";
import { buildCamoufoxOptions, buildPawtectContextProfile } from "../../../src/server/fingerprintConfig";
import { LogRepository } from "../../../src/server/logRepository";
import { AppConfig } from "../../../src/server/appConfig";
import { ProcessRegistry } from "../../../src/server/processRegistry";

/**
 * POST /api/launch
 * Body: { id: string, url: string, proxyId?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string; proxyId?: string; autoPaint?: boolean };

  const id = String(body.id || "");
  const requestedUrl = String(body.url || "");
  const proxyId = String(body.proxyId || "").trim();
  const autoPaint = body.autoPaint === true;

  if (!id) {
    LogRepository.warn("Launch request missing id", undefined, { url: requestedUrl, proxyId });
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) {
    LogRepository.warn("Launch request for unknown profile", undefined, { profileId: id });
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  const profileUrl = String(profile.url || "").trim();
  const launchUrl = AppConfig.wplaceEnabled
    ? "https://wplace.live"
    : (requestedUrl || profileUrl || "https://wplace.live");

  try {
    const settings = await SettingsRepository.load();
    const proxyEnabled = profile.useProxy !== false;
    let assigned = proxyEnabled ? ProxyAssignmentService.getAssigned(id) : null;

    if (!proxyEnabled) {
      ProxyAssignmentService.release(id);
    } else {
      if (proxyId && assigned?.id !== proxyId) {
        try {
          ProxyAssignmentService.assign(id, proxyId);
          assigned = ProxyAssignmentService.getAssigned(id);
        } catch (e: any) {
          LogRepository.error("Proxy assignment failed", String(e?.message || e), { profileId: id, proxyId });
          return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
        }
      }

      if (!assigned) {
        try {
          assigned = ProxyAssignmentService.assignRandom(id);
        } catch (e: any) {
          if (settings.webshare?.token) {
            try {
              await WebshareSyncService.sync();
              assigned = ProxyAssignmentService.assignRandom(id);
            } catch (syncError: any) {
              LogRepository.error(
                "Proxy sync failed while launching profile",
                String(syncError?.message || syncError),
                { profileId: id }
              );
              assigned = null;
            }
          }
        }
      }
    }

    const proxyServer = assigned ? `http://${assigned.host}:${assigned.port}` : undefined;
    const proxyUsername = settings.webshare?.username;
    const proxyPassword = settings.webshare?.password;
    const camoufoxOptions = buildCamoufoxOptions(profile, assigned ?? undefined);
    const extraEnv: Record<string, string> = {};
    extraEnv.WPLACE_PAWTECT_CONTEXT_PROFILE_JSON = JSON.stringify(
      buildPawtectContextProfile(profile, assigned ?? undefined)
    );
    extraEnv.WPLACE_CAMOUFOX_PLAIN_MODE = process.env.WPLACE_CAMOUFOX_PLAIN_MODE || "1";
    extraEnv.WPLACE_TAMPERMONKEY_RELAXED = process.env.WPLACE_TAMPERMONKEY_RELAXED || "1";
    if (AppConfig.wplaceScriptUrl) {
      extraEnv.WPLACE_TAMPERMONKEY_SCRIPT_URL = AppConfig.wplaceScriptUrl;
    }
    if (AppConfig.wplaceEnabled) {
      if (settings.wplaceLocalStorage && Object.keys(settings.wplaceLocalStorage).length > 0) {
        extraEnv.WPLACE_LOCALSTORAGE_JSON = JSON.stringify(settings.wplaceLocalStorage);
      } else if (settings.wplaceBotStorage) {
        extraEnv.WPLACE_WBOT_STORAGE = settings.wplaceBotStorage;
      }
      extraEnv.WPLACE_APP_LANGUAGE = settings.language === "en" ? "en" : "es";
      if (settings.serialActivated) {
        extraEnv.WPLACE_SERIAL_ACTIVATED = "1";
      }
      extraEnv.WPLACE_ENABLED = "1";
    }
    if (autoPaint && /^https?:\/\/(www\.)?wplace\.live\b/i.test(launchUrl)) {
      extraEnv.WPLACE_AUTO_PAINT = "1";
    }
    const pid = CamoufoxLauncher.launch(
      id,
      launchUrl,
      proxyServer,
      proxyUsername,
      proxyPassword,
      camoufoxOptions,
      settings.addonUrl,
      extraEnv
    );
    if (pid <= 0) {
      LogRepository.error("Camoufox launch failed", "PID not returned", { profileId: id, url: launchUrl });
      return NextResponse.json({ error: "Failed to launch Camoufox." }, { status: 500 });
    }

    // record last opened
    ProfileRepositorySqlite.update(id, { lastOpenedAt: new Date().toISOString() } as any);
    ProcessRegistry.register(id, pid, launchUrl);
    LogRepository.info("Camoufox launched", {
      profileId: id,
      url: launchUrl,
      pid,
      proxyId: assigned?.id ?? null,
    });

    return NextResponse.json({ ok: true, pid });
  } catch (e: any) {
    LogRepository.error("Launch request failed", String(e?.message || e), { profileId: id, url: launchUrl });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
