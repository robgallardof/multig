import { NextResponse } from "next/server";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { SettingsRepository } from "../../../src/server/settingsRepository";

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

  const all = ProfileRepositorySqlite.list();
const profile = all.find(x => x.id === id);

const proxyServer = profile?.proxyServer;
const proxyUsername = profile?.proxyUsername;
const proxyPassword = profile?.proxyPassword;

const pid = CamoufoxLauncher.launch(id, url, proxyServer, proxyUsername, proxyPassword);

  // record last opened
  ProfileRepositorySqlite.update(id, { lastOpenedAt: new Date().toISOString() } as any);

  return NextResponse.json({ ok: true, pid });
}
