import { LogRepository } from "./logRepository";
import { ProxyAssignmentService } from "./proxyAssignmentService";
import { ProxyHealthService } from "./proxyHealthService";
import { ProxyPoolRepository } from "./proxyPoolRepository";
import type { WebshareSettings } from "./settingsTypes";
import { WebshareSyncService } from "./webshareSyncService";

export type RuntimeProxy = {
  id: string;
  host: string;
  port: number;
  label?: string;
  countryCode?: string;
  cityName?: string;
};

/**
 * Keeps remote proxy state, local assignments, authentication, and runtime
 * connectivity in one launch-time workflow.
 */
export class ProxyRuntimeService {
  public static async prepare(
    profileId: string,
    targetUrl: string,
    webshare: WebshareSettings | undefined,
    preferredProxyId?: string,
  ): Promise<RuntimeProxy> {
    if (webshare?.token) {
      try {
        const synced = await WebshareSyncService.ensureFresh();
        if (!synced.skipped) {
          LogRepository.info("Webshare proxies auto-synced", {
            imported: synced.imported,
            removed: synced.removed,
            releasedProfiles: synced.releasedProfileIds.length,
          });
        }
      } catch (error: any) {
        // A short Webshare API outage should not discard a previously synced,
        // working pool. Connectivity checks below still protect the launch.
        LogRepository.warn("Webshare auto-sync failed; using cached proxy pool", String(error?.message || error), {
          profileId,
        });
      }
    }

    let assigned = ProxyAssignmentService.getAssigned(profileId);
    const preferred = String(preferredProxyId || "").trim();
    if (preferred && assigned?.id !== preferred) {
      if (ProxyPoolRepository.exists(preferred)) {
        ProxyAssignmentService.assign(profileId, preferred);
        assigned = ProxyAssignmentService.getAssigned(profileId);
      } else {
        LogRepository.warn("Ignoring stale preferred proxy", undefined, { profileId, proxyId: preferred });
      }
    }

    const poolSize = ProxyPoolRepository.counts().total;
    const maxAttempts = Math.min(Math.max(poolSize, 1), 6);
    const errors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!assigned) assigned = ProxyAssignmentService.assignRandom(profileId);
      const health = await ProxyHealthService.testTunnel(assigned, targetUrl, webshare);
      if (health.ok) {
        ProxyPoolRepository.markHealthy(assigned.id);
        if (attempt > 1) {
          LogRepository.info("Working proxy selected after automatic rotation", {
            profileId,
            proxyId: assigned.id,
            attempt,
          });
        }
        return assigned;
      }

      const reason = health.error || `Proxy CONNECT failed (${health.statusCode || "unknown"})`;
      errors.push(reason);
      LogRepository.warn("Proxy preflight failed; rotating automatically", reason, {
        profileId,
        proxyId: assigned.id,
        attempt,
        statusCode: health.statusCode ?? null,
      });
      ProxyPoolRepository.markUnavailable(assigned.id, reason);
      ProxyAssignmentService.release(profileId);
      assigned = null;
    }

    throw new Error(`No working Webshare proxy found after ${maxAttempts} attempts: ${errors.join(" | ")}`);
  }
}
