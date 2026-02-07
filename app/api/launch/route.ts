import { NextResponse } from "next/server";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { WebshareSyncService } from "../../../src/server/webshareSyncService";

/**
 * POST /api/launch
 * Body: { id: string, url: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string };

  const id = String(body.id || "");
  const url = String(body.url || "");

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  let assigned = ProxyAssignmentService.getAssigned(id);

  if (!assigned) {
    try {
      assigned = ProxyAssignmentService.assignRandom(id);
    } catch (e: any) {
      const settings = await SettingsRepository.load();
      if (!settings.webshare?.token) {
        return NextResponse.json({ error: "Configure Webshare before opening a profile." }, { status: 400 });
      }

      try {
        await WebshareSyncService.sync();
        assigned = ProxyAssignmentService.assignRandom(id);
      } catch (inner: any) {
        return NextResponse.json({ error: String(inner?.message || inner) }, { status: 400 });
      }
    }
  }

  const settings = await SettingsRepository.load();
  const proxyServer = assigned ? `http://${assigned.host}:${assigned.port}` : undefined;
  const proxyUsername = settings.webshare?.username;
  const proxyPassword = settings.webshare?.password;

  const pid = CamoufoxLauncher.launch(id, url, proxyServer, proxyUsername, proxyPassword);

  // record last opened
  ProfileRepositorySqlite.update(id, { lastOpenedAt: new Date().toISOString() } as any);

  return NextResponse.json({ ok: true, pid });
}
