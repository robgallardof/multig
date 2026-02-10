import path from "node:path";
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { AppPaths } from "./paths";
import { PythonSetup } from "./pythonSetup";
import { LogRepository } from "./logRepository";

/**
 * Launches Camoufox via Python runner.
 *
 * SRP: spawning only.
 *
 * @since 2026-01-23
 */
export class CamoufoxLauncher {
  /**
   * Prepares a profile by launching Camoufox once to install addons/userscripts and then exiting.
   *
   * @returns true when preparation succeeds.
   * @since 2026-02-10
   */
  public static prepareProfile(
    profileId: string,
    url: string,
    config?: Record<string, unknown>,
    addonUrl?: string,
    extraEnv?: Record<string, string>
  ): boolean {
    const py = PythonSetup.python();
    const profileDir = path.join(AppPaths.profilesDir(), profileId);
    const args = ["-u", AppPaths.runOnePy(), "--profile", profileDir, "--url", url, "--prepare-only"];

    if (config) args.push("--config-json", JSON.stringify(config));
    if (addonUrl) args.push("--addon-url", addonUrl);

    const result = spawnSync(py, args, {
      cwd: process.cwd(),
      stdio: "ignore",
      env: {
        ...process.env,
        ...(extraEnv || {}),
      },
    });

    if (result.status !== 0) {
      LogRepository.error("Camoufox profile preparation failed", String(result.status ?? "unknown"), {
        profileId,
        url,
      });
      return false;
    }

    LogRepository.info("Camoufox profile prepared", { profileId, url });
    return true;
  }

  /**
   * Launches one window.
   *
   * @param profileId Profile id (directory name under profiles/).
   * @param url URL to open.
   * @returns PID or -1.
   * @since 2026-01-23
   */
  public static launch(
    profileId: string,
    url: string,
    proxyServer?: string,
    proxyUsername?: string,
    proxyPassword?: string,
    config?: Record<string, unknown>,
    addonUrl?: string,
    extraEnv?: Record<string, string>
  ): number {
    const py = PythonSetup.python();

    const profileDir = path.join(AppPaths.profilesDir(), profileId);

    const args = ["-u", AppPaths.runOnePy(), "--profile", profileDir, "--url", url];

    if (proxyServer) args.push("--proxy-server", proxyServer);
    if (proxyUsername) args.push("--proxy-username", proxyUsername);
    if (proxyPassword) args.push("--proxy-password", proxyPassword);
    if (config) args.push("--config-json", JSON.stringify(config));
    if (addonUrl) args.push("--addon-url", addonUrl);

    const child = spawn(py, args, {
      cwd: process.cwd(),
      stdio: "ignore",
      detached: true,
      windowsHide: false,
      env: {
        ...process.env,
        ...(extraEnv || {}),
      },
    });

    child.on("error", (err) => {
      LogRepository.error("Camoufox process error", String(err?.message || err), {
        profileId,
        url,
        pid: child.pid ?? null,
      });
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        LogRepository.info("Camoufox process exited", { profileId, url, pid: child.pid ?? null });
        return;
      }
      LogRepository.error("Camoufox process exited unexpectedly", String(code ?? "unknown"), {
        profileId,
        url,
        pid: child.pid ?? null,
        signal: signal ?? null,
      });
    });

    child.unref();

    return child.pid ?? -1;
  }
}
