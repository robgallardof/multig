import { NextResponse } from "next/server";
import { PythonSetup } from "../../../../src/server/pythonSetup";

/**
 * POST /api/system/setup
 *
 * @since 2026-01-23
 */
export async function POST() {
  PythonSetup.installAndFetch();
  return NextResponse.json({ ok: true });
}
