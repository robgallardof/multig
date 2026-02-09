import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../src/server/profilePresenter";
import { LogRepository } from "../../../src/server/logRepository";

/**
 * GET /api/profiles
 *
 * @since 2026-01-23
 */
export async function GET() {
  try {
    const profiles = ProfileRepositorySqlite.list();
    return NextResponse.json({ profiles: listPublicProfiles(profiles) });
  } catch (e: any) {
    LogRepository.error("Profiles list failed", String(e?.message || e));
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}

/**
 * POST /api/profiles
 * Body: { name: string, icon: string, url?: string, osType?: string }
 *
 * @since 2026-01-23
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; icon?: string; url?: string; osType?: string };

    const name = body.name ? String(body.name).trim() : "";
    const icon = body.icon ? String(body.icon).trim() : "fox";
    const url = body.url ? String(body.url).trim() : undefined;
    const osType = body.osType === "mac" || body.osType === "linux" || body.osType === "windows"
      ? body.osType
      : "windows";

    if (!name) {
      LogRepository.warn("Profile create missing name");
      return NextResponse.json({ error: "name is required", profiles: [] }, { status: 400 });
    }

    const p: any = {
      id: crypto.randomUUID(),
      name,
      icon,
      url,
      osType,
      createdAt: new Date().toISOString(),
    };

    const profiles = ProfileRepositorySqlite.create(p as any);
    const createdId = p.id;
    LogRepository.info("Profile created", { profileId: createdId, name });
    return NextResponse.json({ createdId, profiles: listPublicProfiles(profiles) });
  } catch (e: any) {
    LogRepository.error("Profile create failed", String(e?.message || e));
    return NextResponse.json({ error: String(e?.message || e), profiles: [] }, { status: 500 });
  }
}
