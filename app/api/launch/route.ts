import { NextResponse } from "next/server";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { WebshareSyncService } from "../../../src/server/webshareSyncService";
import { buildCamoufoxOptions } from "../../../src/server/fingerprintConfig";
import { LogRepository } from "../../../src/server/logRepository";

/**
 * POST /api/launch
 * Body: { id: string, url: string, proxyId?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string; proxyId?: string };

  const id = String(body.id || "");
  const url = String(body.url || "");
  const proxyId = String(body.proxyId || "").trim();

  if (!id) {
    LogRepository.warn("Launch request missing id", undefined, { url, proxyId });
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (!url) {
    LogRepository.warn("Launch request missing url", undefined, { profileId: id, proxyId });
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) {
    LogRepository.warn("Launch request for unknown profile", undefined, { profileId: id });
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

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

    const pid = CamoufoxLauncher.launch(
      id,
      url,
      proxyServer,
      proxyUsername,
      proxyPassword,
      camoufoxOptions,
      settings.addonUrl
    );
    if (pid <= 0) {
      LogRepository.error("Camoufox launch failed", "PID not returned", { profileId: id, url });
      return NextResponse.json({ error: "Failed to launch Camoufox." }, { status: 500 });
    }

    // record last opened
    ProfileRepositorySqlite.update(id, { lastOpenedAt: new Date().toISOString() } as any);
    LogRepository.info("Camoufox launched", {
      profileId: id,
      url,
      pid,
      proxyId: assigned?.id ?? null,
    });

    return NextResponse.json({ ok: true, pid });
  } catch (e: any) {
    LogRepository.error("Launch request failed", String(e?.message || e), { profileId: id, url });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
