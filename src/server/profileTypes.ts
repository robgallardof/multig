/**
 * Profile model.
 *
 * @since 2026-01-23
 */
export type Profile = {
  /**
   * Optional proxy server URL, e.g. http://ip:port
   */
  proxyServer?: string;

  /**
   * Optional proxy username.
   */
  proxyUsername?: string;

  /**
   * Optional proxy password (stored server-side only).
   */
  proxyPassword?: string;

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
   * ISO timestamp.
   */
  createdAt: string;

  /**
   * ISO timestamp.
   */
  lastOpenedAt?: string;
};
