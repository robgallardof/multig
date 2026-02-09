/**
 * Webshare settings stored server-side only.
 *
 * @since 2026-01-23
 */
export type WebshareSettings = {
  /**
   * Webshare API token (optional).
   * Note: Not required for basic proxy usage, but supported for future features.
   */
  token?: string;

  /**
   * Default proxy username (optional).
   */
  username?: string;

  /**
   * Default proxy password (optional).
   */
  password?: string;
};

/**
 * App settings.
 *
 * @since 2026-01-23
 */
export type AppSettings = {
  webshare?: WebshareSettings;
  language?: "es" | "en";
  addonUrl?: string;
  defaultUrl?: string;
};
