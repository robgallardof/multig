import { NextResponse } from "next/server";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { WebshareSyncService } from "../../../src/server/webshareSyncService";
import { buildCamoufoxOptions } from "../../../src/server/fingerprintConfig";

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

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  const settings = await SettingsRepository.load();
  let assigned = ProxyAssignmentService.getAssigned(id);

  if (proxyId && assigned?.id !== proxyId) {
    try {
      ProxyAssignmentService.assign(id, proxyId);
      assigned = ProxyAssignmentService.getAssigned(id);
    } catch (e: any) {
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
        } catch {
          assigned = null;
        }
      }
    }
  }

  const proxyServer = assigned ? `http://${assigned.host}:${assigned.port}` : undefined;
  const proxyUsername = settings.webshare?.username;
  const proxyPassword = settings.webshare?.password;
  const camoufoxOptions = buildCamoufoxOptions(profile, assigned ?? undefined);

  const pid = CamoufoxLauncher.launch(id, url, proxyServer, proxyUsername, proxyPassword, camoufoxOptions);
  if (pid <= 0) {
    return NextResponse.json({ error: "Failed to launch Camoufox." }, { status: 500 });
  }

  // record last opened
  ProfileRepositorySqlite.update(id, { lastOpenedAt: new Date().toISOString() } as any);

  return NextResponse.json({ ok: true, pid });
}
