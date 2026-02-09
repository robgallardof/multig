import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppPaths } from "./paths";
import { CryptoBox } from "./cryptoBox";
import type { AppSettings } from "./settingsTypes";
import { Db } from "./db";

/**
 * Server-only settings repository.
 * Stores secrets encrypted at rest.
 *
 * SRP: settings persistence only.
 *
 * @since 2026-01-23
 */
export class SettingsRepository {
  private static readonly settingsKey = "app_settings";

  /**
   * Returns the encrypted settings file path.
   *
   * @since 2026-01-23
   */
  private static filePath(): string {
    return path.join(AppPaths.dataDir(), "settings.enc.json");
  }

  /**
   * Loads legacy file-based settings (decrypted).
   *
   * @since 2026-01-23
   */
  private static async loadLegacy(): Promise<AppSettings | null> {
    const p = SettingsRepository.filePath();
    if (!existsSync(p)) return null;

    const raw = await fs.readFile(p, "utf8");
    const blob = JSON.parse(raw) as any;
    return await CryptoBox.decryptJson<AppSettings>(blob);
  }

  /**
   * Loads settings (decrypted). Returns empty object if missing.
   *
   * @since 2026-01-23
   */
  public static async load(): Promise<AppSettings> {
    await fs.mkdir(AppPaths.dataDir(), { recursive: true });

    const db = Db.get();
    const row = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(SettingsRepository.settingsKey) as { value?: string } | undefined;
    if (row?.value) {
      const blob = JSON.parse(row.value) as any;
      return await CryptoBox.decryptJson<AppSettings>(blob);
    }

    const legacy = await SettingsRepository.loadLegacy();
    if (legacy) {
      await SettingsRepository.save(legacy);
      return legacy;
    }

    return {};
  }

  /**
   * Saves settings (encrypted).
   *
   * @since 2026-01-23
   */
  public static async save(settings: AppSettings): Promise<void> {
    await fs.mkdir(AppPaths.dataDir(), { recursive: true });
    const blob = await CryptoBox.encryptJson(settings);
    const db = Db.get();
    db.prepare(
      "INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
    ).run(SettingsRepository.settingsKey, JSON.stringify(blob), new Date().toISOString());
  }

  /**
   * Clears settings (removes encrypted file).
   *
   * @since 2026-01-23
   */
  public static async clear(): Promise<void> {
    const db = Db.get();
    db.prepare("DELETE FROM settings WHERE key = ?").run(SettingsRepository.settingsKey);
    const p = SettingsRepository.filePath();
    if (existsSync(p)) {
      await fs.rm(p, { force: true });
    }
  }
}
