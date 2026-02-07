import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppPaths } from "./paths";
import { CryptoBox } from "./cryptoBox";
import type { AppSettings } from "./settingsTypes";

/**
 * Server-only settings repository.
 * Stores secrets encrypted at rest.
 *
 * SRP: settings persistence only.
 *
 * @since 2026-01-23
 */
export class SettingsRepository {
  /**
   * Returns the encrypted settings file path.
   *
   * @since 2026-01-23
   */
  private static filePath(): string {
    return path.join(AppPaths.dataDir(), "settings.enc.json");
  }

  /**
   * Loads settings (decrypted). Returns empty object if missing.
   *
   * @since 2026-01-23
   */
  public static async load(): Promise<AppSettings> {
    await fs.mkdir(AppPaths.dataDir(), { recursive: true });

    const p = SettingsRepository.filePath();
    if (!existsSync(p)) return {};

    const raw = await fs.readFile(p, "utf8");
    const blob = JSON.parse(raw) as any;
    return await CryptoBox.decryptJson<AppSettings>(blob);
  }

  /**
   * Saves settings (encrypted).
   *
   * @since 2026-01-23
   */
  public static async save(settings: AppSettings): Promise<void> {
    await fs.mkdir(AppPaths.dataDir(), { recursive: true });
    const blob = await CryptoBox.encryptJson(settings);
    await fs.writeFile(SettingsRepository.filePath(), JSON.stringify(blob, null, 2), "utf8");
  }

  /**
   * Clears settings (removes encrypted file).
   *
   * @since 2026-01-23
   */
  public static async clear(): Promise<void> {
    const p = SettingsRepository.filePath();
    if (existsSync(p)) {
      await fs.rm(p, { force: true });
    }
  }
}
