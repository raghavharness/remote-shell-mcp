import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { PersistedSession, SessionState } from "../types.js";

/**
 * Session Persistence Manager
 *
 * Saves session state to disk for:
 * - Crash recovery
 * - Command replay on reconnect
 * - State restoration
 */
export class PersistenceManager {
  private persistDir: string;
  private enabled: boolean = true;

  constructor() {
    this.persistDir = join(homedir(), ".remote-shell", "sessions");
    this.ensureDir();
  }

  private ensureDir(): void {
    try {
      if (!existsSync(this.persistDir)) {
        mkdirSync(this.persistDir, { recursive: true });
      }
    } catch (err) {
      console.error("[remote-shell] Could not create persistence directory:", err);
      this.enabled = false;
    }
  }

  /**
   * Generate a persistence ID
   */
  generatePersistenceId(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * Save session state to disk
   */
  saveSession(session: PersistedSession): boolean {
    if (!this.enabled) return false;

    try {
      const filePath = join(this.persistDir, `${session.persistenceId}.json`);
      writeFileSync(filePath, JSON.stringify(session, null, 2));
      return true;
    } catch (err) {
      console.error("[remote-shell] Failed to save session:", err);
      return false;
    }
  }

  /**
   * Load session state from disk
   */
  loadSession(persistenceId: string): PersistedSession | null {
    if (!this.enabled) return null;

    try {
      const filePath = join(this.persistDir, `${persistenceId}.json`);
      if (!existsSync(filePath)) return null;

      const data = readFileSync(filePath, "utf-8");
      const session = JSON.parse(data) as PersistedSession;

      // Convert date strings back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.lastActivity = new Date(session.lastActivity);
      session.state.lastHeartbeat = new Date(session.state.lastHeartbeat);

      return session;
    } catch (err) {
      console.error("[remote-shell] Failed to load session:", err);
      return null;
    }
  }

  /**
   * Delete session state from disk
   */
  deleteSession(persistenceId: string): boolean {
    if (!this.enabled) return false;

    try {
      const filePath = join(this.persistDir, `${persistenceId}.json`);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[remote-shell] Failed to delete session:", err);
      return false;
    }
  }

  /**
   * List all persisted sessions
   */
  listSessions(): PersistedSession[] {
    if (!this.enabled) return [];

    try {
      const files = readdirSync(this.persistDir).filter(f => f.endsWith(".json"));
      const sessions: PersistedSession[] = [];

      for (const file of files) {
        const persistenceId = file.replace(".json", "");
        const session = this.loadSession(persistenceId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (err) {
      console.error("[remote-shell] Failed to list sessions:", err);
      return [];
    }
  }

  /**
   * Update session state (partial update)
   */
  updateSessionState(persistenceId: string, state: Partial<SessionState>): boolean {
    const session = this.loadSession(persistenceId);
    if (!session) return false;

    session.state = { ...session.state, ...state };
    session.lastActivity = new Date();
    return this.saveSession(session);
  }

  /**
   * Add command to recent commands (for replay)
   */
  addRecentCommand(persistenceId: string, command: string, maxCommands: number = 10): boolean {
    const session = this.loadSession(persistenceId);
    if (!session) return false;

    session.state.recentCommands.push(command);
    if (session.state.recentCommands.length > maxCommands) {
      session.state.recentCommands = session.state.recentCommands.slice(-maxCommands);
    }
    session.lastActivity = new Date();
    return this.saveSession(session);
  }

  /**
   * Get commands to replay on reconnect
   */
  getReplayCommands(persistenceId: string): string[] {
    const session = this.loadSession(persistenceId);
    if (!session) return [];

    // Only replay directory changes and environment setup
    return session.state.recentCommands.filter(cmd => {
      const trimmed = cmd.trim().toLowerCase();
      return (
        trimmed.startsWith("cd ") ||
        trimmed.startsWith("export ") ||
        trimmed.startsWith("source ") ||
        trimmed.startsWith(". ")
      );
    });
  }

  /**
   * Clean up stale persisted sessions
   */
  cleanupStale(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const sessions = this.listSessions();
    const now = Date.now();
    let cleaned = 0;

    for (const session of sessions) {
      const age = now - new Date(session.lastActivity).getTime();
      if (age > maxAgeMs) {
        if (this.deleteSession(session.persistenceId)) {
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Create initial session state
   */
  createInitialState(workingDirectory: string = "~"): SessionState {
    return {
      workingDirectory,
      environmentVars: {},
      recentCommands: [],
      lastHeartbeat: new Date(),
    };
  }

  /**
   * Create a persisted session record
   */
  createPersistedSession(
    id: string,
    originalCommand: string,
    name: string,
    workingDirectory: string = "~"
  ): PersistedSession {
    return {
      id,
      persistenceId: this.generatePersistenceId(),
      originalCommand,
      name,
      state: this.createInitialState(workingDirectory),
      createdAt: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Check if persistence is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get persistence directory path
   */
  getPersistDir(): string {
    return this.persistDir;
  }
}

// Singleton instance
export const persistenceManager = new PersistenceManager();
