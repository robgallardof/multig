import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { cp, mkdir } from "node:fs/promises";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { listPublicProfiles } from "../../../src/server/profilePresenter";
import { LogRepository } from "../../../src/server/logRepository";
import { AppPaths } from "../../../src/server/paths";
import { PythonSetup } from "../../../src/server/pythonSetup";
import { AppConfig } from "../../../src/server/appConfig";
import { importProfileCookiesBatch } from "../../../src/server/cookiesIo";
import type { Profile } from "../../../src/server/profileTypes";
import { CamoufoxLauncher } from "../../../src/server/camoufoxLauncher";
import { buildCamoufoxOptions, buildPawtectContextProfile } from "../../../src/server/fingerprintConfig";
import { SettingsRepository } from "../../../src/server/settingsRepository";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";

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

const REFERENCE_PROFILE_EXCLUDE = new Set([
  "lock",
  ".parentlock",
  "parent.lock",
  "cache2",
  "startupCache",
  "minidumps",
  "crashes",
]) as ReadonlySet<string>;

/**
 * Copies a reference profile into a new profile while skipping volatile runtime files.
 *
 * @since 2026-02-11
 */
async function copyReferenceProfileState(referenceProfileId: string, targetProfileId: string) {
  const sourceRoot = path.join(AppPaths.profilesDir(), referenceProfileId);
  const targetRoot = path.join(AppPaths.profilesDir(), targetProfileId);

  await cp(sourceRoot, targetRoot, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter(sourcePath) {
      const relative = path.relative(sourceRoot, sourcePath);
      if (!relative || relative === ".") return true;
      const firstSegment = relative.split(path.sep)[0] || "";
      return !REFERENCE_PROFILE_EXCLUDE.has(firstSegment);
    },
  });
}

function buildWplaceCookie(value: string) {
  return {
    name: "j",
    value,
    domain: ".backend.wplace.live",
    path: "/",
    secure: true,
    session: false,
    storeId: "Default",
    hostOnly: true,
    httpOnly: true,
    sameSite: "Strict",
    expirationDate: 13416347070.628857,
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
      cookies?: unknown[];
      useProxy?: boolean;
      referenceProfileId?: string;
    };

    if (body.mode === "wplace") {
      if (!AppConfig.wplaceEnabled) {
        LogRepository.warn("Wplace profile create disabled");
        return NextResponse.json({ error: "wplace mode disabled", profiles: [] }, { status: 400 });
      }
      const tokens = Array.isArray(body.tokens)
        ? body.tokens.map(token => String(token).trim()).filter(Boolean)
        : [];
      const cookies = Array.isArray(body.cookies) ? body.cookies : [];
      if (tokens.length === 0 && cookies.length === 0) {
        LogRepository.warn("Wplace profile create missing tokens and cookies");
        return NextResponse.json({ error: "tokens or cookies are required", profiles: [] }, { status: 400 });
      }
      if (!PythonSetup.status().venvExists) {
        LogRepository.warn("Wplace profile create without python env");
        return NextResponse.json({ error: "python environment not ready", profiles: [] }, { status: 400 });
      }

      const osType = body.osType === "mac" || body.osType === "linux" || body.osType === "windows"
        ? body.osType
        : "windows";
      const createdAt = new Date().toISOString();
      const useProxy = body.useProxy !== false;
      const referenceProfileId = typeof body.referenceProfileId === "string" ? body.referenceProfileId.trim() : "";
      if (referenceProfileId) {
        const referenceProfile = ProfileRepositorySqlite.getById(referenceProfileId);
        if (!referenceProfile) {
          return NextResponse.json({ error: "reference profile not found", profiles: [] }, { status: 400 });
        }
      }
      const instanceCount = tokens.length > 0 ? tokens.length : 1;
      const items: Array<Omit<Profile, "id"> & { id: string }> = Array.from({ length: instanceCount }).map(() => ({
        id: crypto.randomUUID(),
        name: buildRandomName(),
        icon: "👤",
        url: "https://wplace.live",
        osType,
        useProxy,
        createdAt,
      }));

      ProfileRepositorySqlite.createMany(items);

      // New profile ids must never inherit proxy assignment from any reference profile.
      // We only clone extension artifacts; proxy IP is resolved independently per profile.
      for (const item of items) {
        ProxyAssignmentService.release(item.id);
      }

      await Promise.all(items.map(async item => {
        const profileDir = path.join(AppPaths.profilesDir(), item.id);
        await mkdir(profileDir, { recursive: true });
        if (referenceProfileId) {
          await copyReferenceProfileState(referenceProfileId, item.id);
        }
      }));

      importProfileCookiesBatch(items.map((item, index) => ({
        profileDir: path.join(AppPaths.profilesDir(), item.id),
        cookies: [
          ...(tokens[index] ? [buildWplaceCookie(tokens[index])] : []),
          ...cookies,
        ],
      })));

      const settings = await SettingsRepository.load();
      const sharedEnv: Record<string, string> = {};
      if (AppConfig.wplaceScriptUrl) {
        sharedEnv.WPLACE_TAMPERMONKEY_SCRIPT_URL = AppConfig.wplaceScriptUrl;
      }
      if (AppConfig.wplaceEnabled && settings.wplaceBotStorage) {
        sharedEnv.WPLACE_WBOT_STORAGE = settings.wplaceBotStorage;
        sharedEnv.WPLACE_ENABLED = "1";
      }

      let preparedCount = 0;
      for (const item of items) {
        const options = buildCamoufoxOptions(item);
        const extraEnv = {
          ...sharedEnv,
          WPLACE_PAWTECT_CONTEXT_PROFILE_JSON: JSON.stringify(buildPawtectContextProfile(item)),
        };
        const prepared = CamoufoxLauncher.prepareProfile(
          item.id,
          "https://wplace.live",
          options,
          settings.addonUrl,
          extraEnv
        );
        if (prepared) {
          preparedCount += 1;
        }
      }

      LogRepository.info("Wplace profiles created", { count: items.length, preparedCount, referenceProfileId: referenceProfileId || null });
      const profiles = ProfileRepositorySqlite.list();
      return NextResponse.json({ profiles: listPublicProfiles(profiles) });
    }

    const name = body.name ? String(body.name).trim() : "";
    const icon = body.icon ? String(body.icon).trim() : "fox";
    const url = body.url ? String(body.url).trim() : undefined;
    const osType = body.osType === "mac" || body.osType === "linux" || body.osType === "windows"
      ? body.osType
      : "windows";
    const useProxy = body.useProxy !== false;

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
      useProxy,
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
