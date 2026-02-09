import { Db } from "./db";
import { CryptoBox } from "./cryptoBox";

type AccessTokenPayload<T> = {
  tokens: T[];
  savedAt: string;
};

/**
 * Access token repository (encrypted at rest).
 *
 * SRP: persistence for access tokens only.
 *
 * @since 2026-01-23
 */
export class AccessTokenRepository {
  private static readonly key = "access_tokens";

  public static async load<T>(): Promise<AccessTokenPayload<T> | null> {
    const db = Db.get();
    const row = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(AccessTokenRepository.key) as { value?: string } | undefined;
    if (!row?.value) return null;
    const blob = JSON.parse(row.value) as any;
    return await CryptoBox.decryptJson<AccessTokenPayload<T>>(blob);
  }

  public static async save<T>(tokens: T[]): Promise<void> {
    const payload: AccessTokenPayload<T> = {
      tokens,
      savedAt: new Date().toISOString(),
    };
    const blob = await CryptoBox.encryptJson(payload);
    const db = Db.get();
    db.prepare(
      "INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
    ).run(AccessTokenRepository.key, JSON.stringify(blob), new Date().toISOString());
  }
}
