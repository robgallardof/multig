import { NextResponse } from "next/server";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { ProcessRegistry } from "../../../src/server/processRegistry";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { buildCamoufoxOptions, buildPawtectContextProfile } from "../../../src/server/fingerprintConfig";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";

export async function GET() {
  const s = await SettingsRepository.load();
  const q = s.autoPaint || {};
  return NextResponse.json({ enabled: q.enabled === true, queue: q.queue || [], currentIndex: q.currentIndex || 0 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { action?: "start" | "stop" | "tick"; queue?: string[] };
  const s = await SettingsRepository.load();
  s.autoPaint = s.autoPaint || {};

  if (body.action === "stop") {
    s.autoPaint.enabled = false;
    s.autoPaint.updatedAt = new Date().toISOString();
    await SettingsRepository.save(s);
    return NextResponse.json({ ok: true, enabled: false });
  }

  if (body.action === "start") {
    const queue = Array.isArray(body.queue) ? body.queue.filter(Boolean) : [];
    s.autoPaint = { enabled: queue.length > 0, queue, currentIndex: 0, updatedAt: new Date().toISOString() };
    await SettingsRepository.save(s);
    return NextResponse.json({ ok: true, enabled: s.autoPaint.enabled, queue });
  }

  const cfg = s.autoPaint || {};
  if (cfg.enabled !== true || !Array.isArray(cfg.queue) || cfg.queue.length === 0) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  if (ProcessRegistry.activeProfileIds().length > 0) {
    return NextResponse.json({ ok: true, enabled: true, waiting: true });
  }

  const idx = Math.max(0, Math.min(cfg.currentIndex || 0, cfg.queue.length - 1));
  const id = cfg.queue[idx];
  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) {
    cfg.currentIndex = idx + 1;
    cfg.updatedAt = new Date().toISOString();
    if ((cfg.currentIndex || 0) >= cfg.queue.length) cfg.enabled = false;
    s.autoPaint = cfg;
    await SettingsRepository.save(s);
    return NextResponse.json({ ok: true, skipped: true, enabled: cfg.enabled === true });
  }

  const url = (profile.url || "https://wplace.live").trim() || "https://wplace.live";
  const assigned = profile.useProxy === false ? null : (ProxyAssignmentService.getAssigned(id) || ProxyAssignmentService.assignRandom(id));
  const proxyServer = assigned ? `http://${assigned.host}:${assigned.port}` : undefined;
  const pid = CamoufoxLauncher.launch(id, url, proxyServer, undefined, undefined, buildCamoufoxOptions(profile, assigned || undefined), s.addonUrl, {
    WPLACE_PAWTECT_CONTEXT_PROFILE_JSON: JSON.stringify(buildPawtectContextProfile(profile, assigned || undefined)),
    WPLACE_AUTO_PAINT: "1",
    WPLACE_ENABLED: "1",
  });
  if (pid > 0) {
    ProcessRegistry.register(id, pid, url);
  }

  cfg.currentIndex = idx + 1;
  if ((cfg.currentIndex || 0) >= cfg.queue.length) cfg.enabled = false;
  cfg.updatedAt = new Date().toISOString();
  s.autoPaint = cfg;
  await SettingsRepository.save(s);

  return NextResponse.json({ ok: true, enabled: cfg.enabled === true, launched: pid > 0, profileId: id });
}
