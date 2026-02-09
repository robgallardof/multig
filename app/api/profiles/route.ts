import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../src/server/profilePresenter";
import { LogRepository } from "../../../src/server/logRepository";
import { AppPaths } from "../../../src/server/paths";
import { PythonSetup } from "../../../src/server/pythonSetup";
import { AppConfig } from "../../../src/server/appConfig";

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
function runCookieTool(action: "import" | "export", profileDir: string, input?: string): string {
  const py = PythonSetup.python();
  const args = [AppPaths.cookiesIoPy(), "--profile", profileDir, "--action", action];
  const result = spawnSync(py, args, {
    input,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || "Cookie import/export failed.");
  }

  return result.stdout || "";
}

function buildWplaceCookie(value: string) {
  return {
    name: "j",
    value,
    domain: ".backend.wplace.live",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
  };
}

function buildRandomName() {
  return `wplace-${crypto.randomBytes(4).toString("hex")}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      mode?: string;
      name?: string;
      icon?: string;
      url?: string;
      osType?: string;
      tokens?: string[];
    };

    if (body.mode === "wplace") {
      if (!AppConfig.wplaceEnabled) {
        LogRepository.warn("Wplace profile create disabled");
        return NextResponse.json({ error: "wplace mode disabled", profiles: [] }, { status: 400 });
      }
      const tokens = Array.isArray(body.tokens)
        ? body.tokens.map(token => String(token).trim()).filter(Boolean)
        : [];
      if (tokens.length === 0) {
        LogRepository.warn("Wplace profile create missing tokens");
        return NextResponse.json({ error: "tokens are required", profiles: [] }, { status: 400 });
      }
      if (!PythonSetup.status().venvExists) {
        LogRepository.warn("Wplace profile create without python env");
        return NextResponse.json({ error: "python environment not ready", profiles: [] }, { status: 400 });
      }

      const osType = body.osType === "mac" || body.osType === "linux" || body.osType === "windows"
        ? body.osType
        : "windows";
      const createdAt = new Date().toISOString();
      const items = tokens.map(() => ({
        id: crypto.randomUUID(),
        name: buildRandomName(),
        icon: "👤",
        url: "https://wplace.live",
        osType,
        createdAt,
      }));

      ProfileRepositorySqlite.createMany(items);

      await Promise.all(items.map(async (item, index) => {
        const profileDir = path.join(AppPaths.profilesDir(), item.id);
        await mkdir(profileDir, { recursive: true });
        const cookies = [buildWplaceCookie(tokens[index])];
        runCookieTool("import", profileDir, JSON.stringify(cookies));
      }));

      LogRepository.info("Wplace profiles created", { count: items.length });
      const profiles = ProfileRepositorySqlite.list();
      return NextResponse.json({ profiles: listPublicProfiles(profiles) });
    }

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
