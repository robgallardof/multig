import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { AppPaths } from "./paths";

/**
 * Python environment setup helpers.
 *
 * SRP: only installs python deps + camoufox fetch.
 *
 * @since 2026-01-23
 */
export class PythonSetup {
  /**
   * Returns a usable python executable:
   * 1) env PYTHON_PATH
   * 2) ./python/.venv python if exists
   * 3) Windows: "py"
   * 4) fallback: "python"
   *
   * @since 2026-01-23
   */
  public static python(): string {
    const env = (process.env.PYTHON_PATH || "").trim();
    if (env) return env;

    const venv = AppPaths.venvPython();
    if (existsSync(venv)) return venv;

    return process.platform === "win32" ? "py" : "python3";
  }

  /**
   * Creates venv if missing.
   *
   * @since 2026-01-23
   */
  public static ensureVenv(): void {
    const venv = AppPaths.venvPython();
    if (existsSync(venv)) return;

    // Create venv under python/.venv using system python launcher
    const basePython = process.platform === "win32" ? "py" : "python3";
    const r = spawnSync(basePython, ["-m", "venv", "./python/.venv"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("Failed to create python venv.");
  }

  /**
   * Installs requirements and runs camoufox fetch.
   *
   * @since 2026-01-23
   */
  public static installAndFetch(): void {
    PythonSetup.ensureVenv();
    const py = AppPaths.venvPython();

    let r = spawnSync(py, ["-m", "pip", "install", "--upgrade", "pip"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("pip upgrade failed.");

    r = spawnSync(py, ["-m", "pip", "install", "-r", "./python/requirements.txt"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("pip install requirements failed.");

    r = spawnSync(py, ["-m", "camoufox", "fetch"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("camoufox fetch failed.");
  }

  /**
   * Quick readiness check.
   *
   * @since 2026-01-23
   */
  public static status(): { venvExists: boolean } {
    return { venvExists: existsSync(AppPaths.venvPython()) };
  }
}
