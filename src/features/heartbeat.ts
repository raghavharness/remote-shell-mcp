import { ShellSession, ConnectionEvent } from "../types.js";
import { EventEmitter } from "events";

export interface HeartbeatOptions {
  interval: number;        // How often to check (ms)
  timeout: number;         // How long to wait for response (ms)
  maxMissed: number;       // How many missed heartbeats before disconnect
  command: string;         // Command to use for heartbeat
}

const DEFAULT_HEARTBEAT_OPTIONS: HeartbeatOptions = {
  interval: 5000,          // Check every 5 seconds
  timeout: 3000,           // Wait 3 seconds for response
  maxMissed: 3,            // 3 missed = disconnect
  command: "echo __hb__",  // Simple echo command
};

interface HeartbeatState {
  sessionId: string;
  interval: ReturnType<typeof setInterval>;
  lastSuccess: Date;
  missedCount: number;
  isChecking: boolean;
}

/**
 * Heartbeat Manager - Connection health monitoring
 *
 * Periodically sends lightweight commands to verify connection is alive.
 * Detects disconnections faster than waiting for command timeout.
 */
export class HeartbeatManager extends EventEmitter {
  private heartbeats: Map<string, HeartbeatState> = new Map();
  private options: HeartbeatOptions;

  constructor(options: Partial<HeartbeatOptions> = {}) {
    super();
    this.options = { ...DEFAULT_HEARTBEAT_OPTIONS, ...options };
  }

  /**
   * Start heartbeat monitoring for a session
   */
  startHeartbeat(
    session: ShellSession,
    execCommand: (session: ShellSession, cmd: string, timeout: number) => Promise<string>
  ): () => void {
    // Stop existing heartbeat if any
    this.stopHeartbeat(session.id);

    const state: HeartbeatState = {
      sessionId: session.id,
      interval: setInterval(async () => {
        await this.checkHeartbeat(session, state, execCommand);
      }, this.options.interval),
      lastSuccess: new Date(),
      missedCount: 0,
      isChecking: false,
    };

    this.heartbeats.set(session.id, state);

    // Return cleanup function
    return () => this.stopHeartbeat(session.id);
  }

  /**
   * Perform a heartbeat check
   */
  private async checkHeartbeat(
    session: ShellSession,
    state: HeartbeatState,
    execCommand: (session: ShellSession, cmd: string, timeout: number) => Promise<string>
  ): Promise<void> {
    // Skip if already checking
    if (state.isChecking) return;

    // Skip if session is not connected
    if (!session.connected) return;

    state.isChecking = true;

    try {
      const result = await Promise.race([
        execCommand(session, this.options.command, this.options.timeout),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Heartbeat timeout")), this.options.timeout)
        ),
      ]);

      if (result && String(result).includes("__hb__")) {
        // Success
        state.lastSuccess = new Date();
        state.missedCount = 0;

        this.emit("heartbeat", {
          type: "heartbeat",
          sessionId: session.id,
          timestamp: new Date(),
        });
      } else {
        // Unexpected response
        this.handleMissed(session, state);
      }
    } catch (error) {
      this.handleMissed(session, state);
    } finally {
      state.isChecking = false;
    }
  }

  /**
   * Handle a missed heartbeat
   */
  private handleMissed(session: ShellSession, state: HeartbeatState): void {
    state.missedCount++;

    this.emit("missed", {
      type: "missed",
      sessionId: session.id,
      timestamp: new Date(),
      missedCount: state.missedCount,
    });

    if (state.missedCount >= this.options.maxMissed) {
      // Connection is dead
      session.connected = false;

      this.emit("disconnected", {
        type: "disconnected",
        sessionId: session.id,
        timestamp: new Date(),
        error: new Error(`Connection lost (${state.missedCount} missed heartbeats)`),
      } as ConnectionEvent);

      // Stop monitoring this session
      this.stopHeartbeat(session.id);
    }
  }

  /**
   * Stop heartbeat monitoring for a session
   */
  stopHeartbeat(sessionId: string): void {
    const state = this.heartbeats.get(sessionId);
    if (state) {
      clearInterval(state.interval);
      this.heartbeats.delete(sessionId);
    }
  }

  /**
   * Stop all heartbeats
   */
  stopAll(): void {
    for (const [sessionId] of this.heartbeats) {
      this.stopHeartbeat(sessionId);
    }
  }

  /**
   * Get heartbeat status for a session
   */
  getStatus(sessionId: string): {
    active: boolean;
    lastSuccess: Date | null;
    missedCount: number;
  } {
    const state = this.heartbeats.get(sessionId);
    if (!state) {
      return { active: false, lastSuccess: null, missedCount: 0 };
    }
    return {
      active: true,
      lastSuccess: state.lastSuccess,
      missedCount: state.missedCount,
    };
  }

  /**
   * Check if heartbeat is active for session
   */
  isActive(sessionId: string): boolean {
    return this.heartbeats.has(sessionId);
  }

  /**
   * Reset heartbeat (call after successful command)
   */
  resetHeartbeat(sessionId: string): void {
    const state = this.heartbeats.get(sessionId);
    if (state) {
      state.lastSuccess = new Date();
      state.missedCount = 0;
    }
  }

  /**
   * Get time since last successful heartbeat
   */
  getTimeSinceLastSuccess(sessionId: string): number | null {
    const state = this.heartbeats.get(sessionId);
    if (!state) return null;
    return Date.now() - state.lastSuccess.getTime();
  }

  /**
   * Update heartbeat options
   */
  setOptions(options: Partial<HeartbeatOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): HeartbeatOptions {
    return { ...this.options };
  }
}

// Singleton instance
export const heartbeatManager = new HeartbeatManager();
