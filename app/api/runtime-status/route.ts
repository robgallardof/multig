import { NextResponse } from "next/server";
import { ProcessRegistry } from "../../../src/server/processRegistry";

/**
 * GET /api/runtime-status
 *
 * Returns active profile ids after cleaning stale processes.
 *
 * @since 2026-02-10
 */
export async function GET() {
  const activeProfileIds = ProcessRegistry.activeProfileIds();
  return NextResponse.json({ activeProfileIds });
}
