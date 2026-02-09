import type { Profile } from "./profileTypes";
import { ProxyAssignmentService } from "./proxyAssignmentService";

/**
 * Public profile shape for the UI.
 *
 * @since 2026-01-23
 */
export type PublicProfile = Profile & {
  hasProxy: boolean;
  proxyId?: string;
  proxyLabel?: string;
  proxyServer?: string;
};

/**
 * Builds a safe UI-friendly profile view model.
 *
 * @since 2026-01-23
 */
export function toPublicProfile(profile: Profile): PublicProfile {
  const assigned = ProxyAssignmentService.getAssigned(profile.id);
  const proxyServer = assigned ? `http://${assigned.host}:${assigned.port}` : undefined;
  const proxyEnabled = profile.useProxy !== false;

  return {
    ...profile,
    useProxy: proxyEnabled,
    hasProxy: proxyEnabled && !!assigned,
    proxyId: proxyEnabled ? assigned?.id : undefined,
    proxyLabel: proxyEnabled ? assigned?.label : undefined,
    proxyServer: proxyEnabled ? proxyServer : undefined,
  };
}

/**
 * Maps profiles to public UI view models.
 *
 * @since 2026-01-23
 */
export function listPublicProfiles(profiles: Profile[]): PublicProfile[] {
  return profiles.map(toPublicProfile);
}
