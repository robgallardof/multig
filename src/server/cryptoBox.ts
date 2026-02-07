import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppPaths } from "./paths";

/**
 * Encrypts/decrypts small JSON payloads at rest (AES-256-GCM).
 *
 * Security notes:
 * - Secrets are NEVER sent to the frontend.
 * - Encrypted blobs are stored in `data/`.
 * - The encryption key is derived from an app secret.
 *
 * @since 2026-01-23
 */
export class CryptoBox {
  /**
   * Returns the absolute path to the local secret file.
   *
   * @since 2026-01-23
   */
  private static secretPath(): string {
    return path.join(AppPaths.dataDir(), "app_secret.txt");
  }

  /**
   * Loads the application secret.
   * Priority:
   * 1) APP_SECRET env var (recommended)
   * 2) data/app_secret.txt (generated once)
   *
   * @since 2026-01-23
   */
  public static async getAppSecret(): Promise<string> {
    const env = (process.env.APP_SECRET || "").trim();
    if (env) return env;

    await fs.mkdir(AppPaths.dataDir(), { recursive: true });

    const p = CryptoBox.secretPath();
    if (existsSync(p)) {
      return (await fs.readFile(p, "utf8")).trim();
    }

    // Generate a local secret (not hardcoded). This is stored server-side only.
    const generated = crypto.randomBytes(32).toString("hex");
    await fs.writeFile(p, generated, "utf8");
    return generated;
  }

  /**
   * Derives a 32-byte key from secret + salt using scrypt.
   *
   * @since 2026-01-23
   */
  private static async deriveKey(secret: string, salt: Buffer): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
      crypto.scrypt(secret, salt, 32, (err, key) => {
        if (err) reject(err);
        else resolve(key as Buffer);
      });
    });
  }

  /**
   * Encrypts an object into an AES-GCM blob.
   *
   * @since 2026-01-23
   */
  public static async encryptJson(payload: unknown): Promise<{
    v: number;
    salt: string;
    iv: string;
    tag: string;
    data: string;
  }> {
    const secret = await CryptoBox.getAppSecret();
    const salt = crypto.randomBytes(16);
    const key = await CryptoBox.deriveKey(secret, salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      v: 1,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: enc.toString("base64"),
    };
  }

  /**
   * Decrypts an AES-GCM blob into JSON.
   *
   * @since 2026-01-23
   */
  public static async decryptJson<T>(blob: {
    v: number;
    salt: string;
    iv: string;
    tag: string;
    data: string;
  }): Promise<T> {
    const secret = await CryptoBox.getAppSecret();
    const salt = Buffer.from(blob.salt, "base64");
    const iv = Buffer.from(blob.iv, "base64");
    const tag = Buffer.from(blob.tag, "base64");
    const key = await CryptoBox.deriveKey(secret, salt);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const enc = Buffer.from(blob.data, "base64");
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  }
}
