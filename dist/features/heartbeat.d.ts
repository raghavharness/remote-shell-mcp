import { ShellSession } from "../types.js";
import { EventEmitter } from "events";
export interface HeartbeatOptions {
    interval: number;
    timeout: number;
    maxMissed: number;
    command: string;
}
/**
 * Heartbeat Manager - Connection health monitoring
 *
 * Periodically sends lightweight commands to verify connection is alive.
 * Detects disconnections faster than waiting for command timeout.
 */
export declare class HeartbeatManager extends EventEmitter {
    private heartbeats;
    private options;
    constructor(options?: Partial<HeartbeatOptions>);
    /**
     * Start heartbeat monitoring for a session
     */
    startHeartbeat(session: ShellSession, execCommand: (session: ShellSession, cmd: string, timeout: number) => Promise<string>): () => void;
    /**
     * Perform a heartbeat check
     */
    private checkHeartbeat;
    /**
     * Handle a missed heartbeat
     */
    private handleMissed;
    /**
     * Stop heartbeat monitoring for a session
     */
    stopHeartbeat(sessionId: string): void;
    /**
     * Stop all heartbeats
     */
    stopAll(): void;
    /**
     * Get heartbeat status for a session
     */
    getStatus(sessionId: string): {
        active: boolean;
        lastSuccess: Date | null;
        missedCount: number;
    };
    /**
     * Check if heartbeat is active for session
     */
    isActive(sessionId: string): boolean;
    /**
     * Reset heartbeat (call after successful command)
     */
    resetHeartbeat(sessionId: string): void;
    /**
     * Get time since last successful heartbeat
     */
    getTimeSinceLastSuccess(sessionId: string): number | null;
    /**
     * Update heartbeat options
     */
    setOptions(options: Partial<HeartbeatOptions>): void;
    /**
     * Get current options
     */
    getOptions(): HeartbeatOptions;
}
export declare const heartbeatManager: HeartbeatManager;
//# sourceMappingURL=heartbeat.d.ts.map