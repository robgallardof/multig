/**
 * Profile model.
 *
 * @since 2026-01-23
 */
export type Profile = {
  /**
   * Stable id (uuid).
   */
  id: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Emoji icon.
   */
  icon: string;

  /**
   * Optional per-profile URL. If empty, use defaultUrl.
   */
  url?: string;

  /**
   * OS type for fingerprint defaults.
   */
  osType?: "windows" | "mac" | "linux";

  /**
   * Whether the profile should use a proxy.
   */
  useProxy?: boolean;

  /**
   * ISO timestamp.
   */
  createdAt: string;

  /**
   * ISO timestamp.
   */
  lastOpenedAt?: string;
};
