import fs from "node:fs";
import path from "node:path";
import { AppPaths } from "./paths";
import { LogRepository } from "./logRepository";

type RuntimeEntry = {
  pid: number;
  startedAt: string;
  url: string;
};

type RuntimeState = {
  processes: Record<string, RuntimeEntry>;
};

/**
 * Stores and manages running Camoufox process metadata.
 *
 * SRP: persistence + liveness checks for launched profile processes.
 *
 * @since 2026-02-10
 */
export class ProcessRegistry {
  private static filePath(): string {
    return path.join(AppPaths.dataDir(), "runtime_processes.json");
  }

  /**
   * Reads runtime state from disk.
   *
   * @since 2026-02-10
   */
  private static readState(): RuntimeState {
    try {
      fs.mkdirSync(AppPaths.dataDir(), { recursive: true });
      const file = ProcessRegistry.filePath();
      if (!fs.existsSync(file)) {
        return { processes: {} };
      }
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as RuntimeState;
      if (!parsed || typeof parsed !== "object" || !parsed.processes || typeof parsed.processes !== "object") {
        return { processes: {} };
      }
      return parsed;
    } catch {
      return { processes: {} };
    }
  }

  /**
   * Writes runtime state to disk.
   *
   * @since 2026-02-10
   */
  private static writeState(state: RuntimeState): void {
    fs.mkdirSync(AppPaths.dataDir(), { recursive: true });
    fs.writeFileSync(ProcessRegistry.filePath(), JSON.stringify(state, null, 2), "utf8");
  }

  /**
   * Registers a started process for a profile.
   *
   * @since 2026-02-10
   */
  public static register(profileId: string, pid: number, url: string): void {
    const state = ProcessRegistry.readState();
    state.processes[profileId] = { pid, startedAt: new Date().toISOString(), url };
    ProcessRegistry.writeState(state);
  }

  /**
   * Returns true when a PID is alive.
   *
   * @since 2026-02-10
   */
  private static hasExpectedProcessCommand(pid: number, profileId: string): boolean {
    if (process.platform !== "linux") return true;
    try {
      const cmdlinePath = `/proc/${pid}/cmdline`;
      if (!fs.existsSync(cmdlinePath)) return false;
      const raw = fs.readFileSync(cmdlinePath, "utf8");
      if (!raw) return false;
      const normalized = raw.replace(/\u0000/g, " ").toLowerCase();
      if (!normalized.includes("run_one.py")) return false;
      return normalized.includes(profileId.toLowerCase());
    } catch {
      return false;
    }
  }

  private static isPidAliveForProfile(pid: number, profileId: string): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return ProcessRegistry.hasExpectedProcessCommand(pid, profileId);
    } catch {
      return false;
    }
  }

  /**
   * Returns active profile ids and removes stale processes.
   *
   * @since 2026-02-10
   */
  public static activeProfileIds(): string[] {
    const state = ProcessRegistry.readState();
    let changed = false;
    const active: string[] = [];

    for (const [profileId, entry] of Object.entries(state.processes)) {
      if (ProcessRegistry.isPidAliveForProfile(entry.pid, profileId)) {
        active.push(profileId);
        continue;
      }
      delete state.processes[profileId];
      changed = true;
    }

    if (changed) ProcessRegistry.writeState(state);
    return active;
  }

  /**
   * Stops a process for a profile when present.
   *
   * @returns true if there was an active process and a stop signal was sent.
   * @since 2026-02-10
   */
  public static stop(profileId: string): boolean {
    const state = ProcessRegistry.readState();
    const entry = state.processes[profileId];
    if (!entry) return false;

    let stopped = false;
    if (ProcessRegistry.isPidAliveForProfile(entry.pid, profileId)) {
      try {
        process.kill(entry.pid, "SIGTERM");
        stopped = true;
      } catch (e: any) {
        LogRepository.warn("Failed to stop Camoufox process", String(e?.message || e), { profileId, pid: entry.pid });
      }
    }

    delete state.processes[profileId];
    ProcessRegistry.writeState(state);
    return stopped;
  }
}
