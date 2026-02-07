import path from "node:path";
import { spawn } from "node:child_process";
import { AppPaths } from "./paths";
import { PythonSetup } from "./pythonSetup";

/**
 * Launches Camoufox via Python runner.
 *
 * SRP: spawning only.
 *
 * @since 2026-01-23
 */
export class CamoufoxLauncher {
  /**
   * Launches one window.
   *
   * @param profileId Profile id (directory name under profiles/).
   * @param url URL to open.
   * @returns PID or -1.
   * @since 2026-01-23
   */
  public static launch(profileId: string, url: string, proxyServer?: string, proxyUsername?: string, proxyPassword?: string): number {
    const py = PythonSetup.python();

    const profileDir = path.join(AppPaths.profilesDir(), profileId);

    const args = ["-u", AppPaths.runOnePy(), "--profile", profileDir, "--url", url];

if (proxyServer) args.push("--proxy-server", proxyServer);
if (proxyUsername) args.push("--proxy-username", proxyUsername);
if (proxyPassword) args.push("--proxy-password", proxyPassword);

    const child = spawn(py, args, {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: false,
    });

    return child.pid ?? -1;
  }
}
