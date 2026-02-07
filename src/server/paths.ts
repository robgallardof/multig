import path from "node:path";

/**
 * Resolves app paths from env + project root.
 *
 * SRP: path resolution only.
 *
 * @since 2026-01-23
 */
export class AppPaths {
  /**
   * Returns absolute profiles directory.
   *
   * @since 2026-01-23
   */
  public static profilesDir(): string {
    return path.resolve(process.cwd(), process.env.PROFILES_DIR || "profiles");
  }

  /**
   * Returns absolute data directory.
   *
   * @since 2026-01-23
   */
  public static dataDir(): string {
    return path.resolve(process.cwd(), process.env.DATA_DIR || "data");
  }

  /**
   * Returns absolute profiles.json path.
   *
   * @since 2026-01-23
   */
  public static profilesJsonPath(): string {
    return path.join(AppPaths.dataDir(), "profiles.json");
  }

  /**
   * Returns absolute path to python runner.
   *
   * @since 2026-01-23
   */
  public static runOnePy(): string {
    return path.resolve(process.cwd(), "python", "run_one.py");
  }

  /**
   * Returns python venv path.
   *
   * @since 2026-01-23
   */
  public static venvPython(): string {
    const isWin = process.platform === "win32";
    return path.resolve(process.cwd(), "python", ".venv", isWin ? "Scripts/python.exe" : "bin/python");
  }
}
