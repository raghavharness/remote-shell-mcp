import { EventEmitter } from "events";
const DEFAULT_HEARTBEAT_OPTIONS = {
    interval: 5000, // Check every 5 seconds
    timeout: 3000, // Wait 3 seconds for response
    maxMissed: 3, // 3 missed = disconnect
    command: "echo __hb__", // Simple echo command
};
/**
 * Heartbeat Manager - Connection health monitoring
 *
 * Periodically sends lightweight commands to verify connection is alive.
 * Detects disconnections faster than waiting for command timeout.
 */
export class HeartbeatManager extends EventEmitter {
    heartbeats = new Map();
    options;
    constructor(options = {}) {
        super();
        this.options = { ...DEFAULT_HEARTBEAT_OPTIONS, ...options };
    }
    /**
     * Start heartbeat monitoring for a session
     */
    startHeartbeat(session, execCommand) {
        // Stop existing heartbeat if any
        this.stopHeartbeat(session.id);
        const state = {
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
    async checkHeartbeat(session, state, execCommand) {
        // Skip if already checking
        if (state.isChecking)
            return;
        // Skip if session is not connected
        if (!session.connected)
            return;
        state.isChecking = true;
        try {
            const result = await Promise.race([
                execCommand(session, this.options.command, this.options.timeout),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Heartbeat timeout")), this.options.timeout)),
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
            }
            else {
                // Unexpected response
                this.handleMissed(session, state);
            }
        }
        catch (error) {
            this.handleMissed(session, state);
        }
        finally {
            state.isChecking = false;
        }
    }
    /**
     * Handle a missed heartbeat
     */
    handleMissed(session, state) {
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
            });
            // Stop monitoring this session
            this.stopHeartbeat(session.id);
        }
    }
    /**
     * Stop heartbeat monitoring for a session
     */
    stopHeartbeat(sessionId) {
        const state = this.heartbeats.get(sessionId);
        if (state) {
            clearInterval(state.interval);
            this.heartbeats.delete(sessionId);
        }
    }
    /**
     * Stop all heartbeats
     */
    stopAll() {
        for (const [sessionId] of this.heartbeats) {
            this.stopHeartbeat(sessionId);
        }
    }
    /**
     * Get heartbeat status for a session
     */
    getStatus(sessionId) {
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
    isActive(sessionId) {
        return this.heartbeats.has(sessionId);
    }
    /**
     * Reset heartbeat (call after successful command)
     */
    resetHeartbeat(sessionId) {
        const state = this.heartbeats.get(sessionId);
        if (state) {
            state.lastSuccess = new Date();
            state.missedCount = 0;
        }
    }
    /**
     * Get time since last successful heartbeat
     */
    getTimeSinceLastSuccess(sessionId) {
        const state = this.heartbeats.get(sessionId);
        if (!state)
            return null;
        return Date.now() - state.lastSuccess.getTime();
    }
    /**
     * Update heartbeat options
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
    /**
     * Get current options
     */
    getOptions() {
        return { ...this.options };
    }
}
// Singleton instance
export const heartbeatManager = new HeartbeatManager();
//# sourceMappingURL=heartbeat.js.map