/**
 * Supported profile icons.
 *
 * KISS: emoji icons are cross-platform and require no assets.
 *
 * @since 2026-01-23
 */
export const profileIcons = ["🧑‍💻", "🧪", "👤", "⚙️", "🦊", "🧠", "📦", "🧰", "📌", "🎯"] as const;

export type ProfileIcon = (typeof profileIcons)[number];
