import { NextResponse } from "next/server";
import { PythonSetup } from "../../../../src/server/pythonSetup";
import { LogRepository } from "../../../../src/server/logRepository";

/**
 * POST /api/system/setup
 *
 * @since 2026-01-23
 */
export async function POST() {
  try {
    PythonSetup.installAndFetch();
    LogRepository.info("Python environment setup completed");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    LogRepository.error("Python environment setup failed", String(e?.message || e));
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
