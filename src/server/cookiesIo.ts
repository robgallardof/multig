import { spawnSync } from "node:child_process";
import { AppPaths } from "./paths";
import { PythonSetup } from "./pythonSetup";

function runCookieTool(action: "import" | "export", profileDir: string, input?: string): string {
  const py = PythonSetup.python();
  const args = [AppPaths.cookiesIoPy(), "--profile", profileDir, "--action", action];
  const result = spawnSync(py, args, {
    input,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || "Cookie import/export failed.");
  }

  return result.stdout || "";
}

function runCookieBatchTool(input: string): void {
  const py = PythonSetup.python();
  const args = [AppPaths.cookiesIoPy(), "--action", "import-batch"];
  const result = spawnSync(py, args, {
    input,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || "Cookie import batch failed.");
  }
}

export function importProfileCookies(profileDir: string, cookies: unknown[]): void {
  runCookieTool("import", profileDir, JSON.stringify(cookies));
}

export function exportProfileCookies(profileDir: string): unknown[] {
  const out = runCookieTool("export", profileDir);
  return out ? (JSON.parse(out) as unknown[]) : [];
}

export function importProfileCookiesBatch(items: Array<{ profileDir: string; cookies: unknown[] }>): void {
  if (items.length === 0) return;
  const payload = items.map(item => ({
    profile: item.profileDir,
    cookies: item.cookies,
  }));
  runCookieBatchTool(JSON.stringify(payload));
}
