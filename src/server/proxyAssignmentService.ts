import { Db } from "./db";
import { ProfileRepositorySqlite } from "./profileRepositorySqlite";
import { ProxyPoolRepository } from "./proxyPoolRepository";

/**
 * Proxy assignment service (manual, non-reusable).
 *
 * Rules:
 * - A proxy can be assigned to ONLY one profile.
 * - A profile can have ONLY one proxy.
 *
 * SRP: assignment rules only.
 *
 * @since 2026-01-23
 */
export class ProxyAssignmentService {
  /**
   * Assigns a proxy to a profile. Throws if proxy already assigned.
   *
   * @since 2026-01-23
   */
  public static assign(profileId: string, proxyId: string): void {
    const db = Db.get();

    const proxy = db.prepare("SELECT id, host, port FROM proxies WHERE id=?").get(proxyId) as any;
    if (!proxy) throw new Error("Proxy not found.");

    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      // Ensure profile exists
      const p = ProfileRepositorySqlite.getById(profileId);
      if (!p) throw new Error("Profile not found.");

      // Enforce uniqueness (DB will enforce too, but we want a nice message)
      const used = db.prepare("SELECT profileId FROM proxy_assignments WHERE proxyId=?").get(proxyId) as any;
      if (used) throw new Error("Proxy already assigned to another profile.");

      // Clear existing assignment for this profile, if any
      db.prepare("DELETE FROM proxy_assignments WHERE profileId=?").run(profileId);

      // Create assignment
      db.prepare("INSERT INTO proxy_assignments (profileId, proxyId, assignedAt) VALUES (?,?,?)")
        .run(profileId, proxyId, now);

    });

    tx();
  }

  /**
   * Assigns a random available proxy to a profile.
   * When force = false and the profile already has a proxy, it returns the existing assignment.
   *
   * @since 2026-01-23
   */
  public static assignRandom(profileId: string, options?: { force?: boolean }): { id: string; host: string; port: number; label?: string } {
    const force = options?.force ?? false;
    const existing = ProxyAssignmentService.getAssigned(profileId);
    if (existing && !force) return existing;

    const pick = ProxyPoolRepository.pickRandomAvailable();
    if (!pick) {
      if (existing && force) {
        throw new Error("No available proxies to rotate.");
      }
      throw new Error("No available proxies.");
    }

    ProxyAssignmentService.assign(profileId, pick.id);
    return { id: pick.id, host: pick.host, port: pick.port, label: pick.label };
  }

  /**
   * Releases a proxy from a profile (if any).
   *
   * @since 2026-01-23
   */
  public static release(profileId: string): void {
    const db = Db.get();

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM proxy_assignments WHERE profileId=?").run(profileId);
    });

    tx();
  }

  /**
   * Gets assigned proxy for a profile.
   *
   * @since 2026-01-23
   */
  public static getAssigned(profileId: string): { id: string; host: string; port: number; label?: string } | null {
    const db = Db.get();
    const row = db.prepare(`
      SELECT p.id, p.host, p.port, p.label
      FROM proxy_assignments a
      JOIN proxies p ON p.id = a.proxyId
      WHERE a.profileId = ?
    `).get(profileId) as any;

    if (!row) return null;
    return { id: String(row.id), host: String(row.host), port: Number(row.port), label: row.label ? String(row.label) : undefined };
  }
}
