import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppPaths } from "./paths";
import type { Profile } from "./profileTypes";

/**
 * JSON + filesystem based repository.
 *
 * SRP: persistence + directories.
 *
 * @since 2026-01-23
 */
export class ProfileRepository {
  /**
   * Ensures base folders and JSON file exist.
   *
   * @since 2026-01-23
   */
  public static async ensure(): Promise<void> {
    await fs.mkdir(AppPaths.dataDir(), { recursive: true });
    await fs.mkdir(AppPaths.profilesDir(), { recursive: true });

    const jsonPath = AppPaths.profilesJsonPath();
    if (!existsSync(jsonPath)) {
      await fs.writeFile(jsonPath, JSON.stringify({ profiles: [] }, null, 2), "utf8");
    }
  }

  /**
   * Reads all profiles.
   *
   * @since 2026-01-23
   */
  public static async list(): Promise<Profile[]> {
    await ProfileRepository.ensure();
    const raw = await fs.readFile(AppPaths.profilesJsonPath(), "utf8");
    const parsed = JSON.parse(raw) as { profiles: Profile[] };
    return (parsed.profiles || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Writes profiles.
   *
   * @since 2026-01-23
   */
  private static async write(all: Profile[]): Promise<void> {
    await ProfileRepository.ensure();
    await fs.writeFile(AppPaths.profilesJsonPath(), JSON.stringify({ profiles: all }, null, 2), "utf8");
  }

  /**
   * Creates a new profile and its directory.
   *
   * @since 2026-01-23
   */
  public static async create(p: Profile): Promise<Profile[]> {
    const all = await ProfileRepository.list();
    all.push(p);

    // Directory per profile: profiles/<id>
    await fs.mkdir(path.join(AppPaths.profilesDir(), p.id), { recursive: true });

    await ProfileRepository.write(all);
    return all;
  }

  /**
   * Updates a profile.
   *
   * @since 2026-01-23
   */
  public static async update(id: string, patch: Partial<Profile>): Promise<Profile[]> {
    const all = await ProfileRepository.list();
    const i = all.findIndex(x => x.id === id);
    if (i < 0) throw new Error("Profile not found.");

    all[i] = { ...all[i], ...patch };
    await ProfileRepository.write(all);
    return all;
  }

  /**
   * Deletes profile and its directory.
   *
   * @since 2026-01-23
   */
  public static async delete(id: string): Promise<Profile[]> {
    const all = await ProfileRepository.list();
    const next = all.filter(x => x.id !== id);

    // Remove directory
    await fs.rm(path.join(AppPaths.profilesDir(), id), { recursive: true, force: true });

    await ProfileRepository.write(next);
    return next;
  }
}
