import { NextResponse } from "next/server";
import { ProfileRepositorySqlite } from "../../../src/server/profileRepositorySqlite";
import { ProxyAssignmentService } from "../../../src/server/proxyAssignmentService";
import { buildCamoufoxOptions, buildPawtectContextProfile } from "../../../src/server/fingerprintConfig";

/**
 * GET /api/fingerprint?id=<profileId>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const profile = ProfileRepositorySqlite.getById(id);
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  const assigned = ProxyAssignmentService.getAssigned(id);
  const proxyMeta = assigned
    ? { countryCode: assigned.countryCode, cityName: assigned.cityName }
    : undefined;

  return NextResponse.json({
    profileId: profile.id,
    profileName: profile.name,
    useProxy: profile.useProxy !== false,
    assignedProxy: assigned,
    camoufoxOptions: buildCamoufoxOptions(profile, proxyMeta),
    pawtectProfile: buildPawtectContextProfile(profile, proxyMeta),
  });
}
