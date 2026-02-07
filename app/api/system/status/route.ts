import { NextResponse } from "next/server";
import { PythonSetup } from "../../../../src/server/pythonSetup";

/**
 * GET /api/system/status
 *
 * @since 2026-01-23
 */
export async function GET() {
  const s = PythonSetup.status();
  return NextResponse.json({ ...s });
}
