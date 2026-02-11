import { NextResponse } from "next/server";
import { AppConfig } from "../../../../src/server/appConfig";

/**
 * GET /api/wplace/userscript
 *
 * Returns the configured Wplace userscript text so it can be copied manually.
 */
export async function GET() {
  try {
    const url = (AppConfig.wplaceScriptUrl || "").trim();
    if (!url) {
      return NextResponse.json({ error: "wplace userscript url not configured" }, { status: 400 });
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `failed to download userscript (${response.status})` },
        { status: 502 }
      );
    }

    const script = await response.text();
    if (!script.trim()) {
      return NextResponse.json({ error: "userscript is empty" }, { status: 502 });
    }

    return new NextResponse(script, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
