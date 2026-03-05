import { EventEmitter } from "events";
export class OutputStreamer extends EventEmitter {
    activeStreams = new Map();
    /**
     * Register a listener for streaming output
     */
    subscribe(session, callback) {
        const sessionId = session.id;
        // Add to our tracking
        if (!this.activeStreams.has(sessionId)) {
            this.activeStreams.set(sessionId, new Set());
        }
        this.activeStreams.get(sessionId).add(callback);
        // Add to session's listeners
        const internalCallback = (data) => {
            callback({
                sessionId,
                data,
                timestamp: new Date(),
                isError: false,
            });
        };
        session.outputListeners.add(internalCallback);
        // Return unsubscribe function
        return () => {
            session.outputListeners.delete(internalCallback);
            const streams = this.activeStreams.get(sessionId);
            if (streams) {
                streams.delete(callback);
                if (streams.size === 0) {
                    this.activeStreams.delete(sessionId);
                }
            }
        };
    }
    /**
     * Get pending output that hasn't been streamed yet
     */
    getPendingOutput(session) {
        const pending = session.pendingOutput;
        session.pendingOutput = "";
        return pending;
    }
    /**
     * Check if a session has active stream listeners
     */
    hasListeners(sessionId) {
        const streams = this.activeStreams.get(sessionId);
        return streams ? streams.size > 0 : false;
    }
    /**
     * Get number of active listeners for a session
     */
    getListenerCount(sessionId) {
        const streams = this.activeStreams.get(sessionId);
        return streams ? streams.size : 0;
    }
    /**
     * Remove all listeners for a session
     */
    clearSessionListeners(session) {
        session.outputListeners.clear();
        this.activeStreams.delete(session.id);
    }
    /**
     * Broadcast output to all listeners
     */
    broadcast(session, data, isError = false) {
        const output = {
            sessionId: session.id,
            data,
            timestamp: new Date(),
            isError,
        };
        // Emit event
        this.emit("output", output);
        // Call all registered callbacks
        for (const listener of session.outputListeners) {
            try {
                listener(data);
            }
            catch (err) {
                console.error("[remote-shell] Output listener error:", err);
            }
        }
    }
}
// Singleton instance
export const outputStreamer = new OutputStreamer();
/**
 * Async generator for streaming output
 */
export async function* streamOutput(session, options = {}) {
    const { timeout = 30000, bufferSize = 1000 } = options;
    const buffer = [];
    let done = false;
    let resolver = null;
    const callback = (data) => {
        buffer.push(data);
        // Trim buffer if too large
        if (buffer.length > bufferSize) {
            buffer.splice(0, buffer.length - bufferSize);
        }
        // Wake up the generator
        if (resolver) {
            resolver();
            resolver = null;
        }
    };
    session.outputListeners.add(callback);
    const startTime = Date.now();
    try {
        while (!done && Date.now() - startTime < timeout) {
            // Yield any buffered data
            while (buffer.length > 0) {
                yield buffer.shift();
            }
            // Wait for new data or timeout
            await new Promise((resolve) => {
                resolver = resolve;
                setTimeout(resolve, 100); // Poll every 100ms
            });
            // Check if session is still connected
            if (!session.connected) {
                done = true;
            }
        }
    }
    finally {
        session.outputListeners.delete(callback);
    }
}
/**
 * Collect output for a specified duration
 */
export async function collectOutput(session, durationMs) {
    const output = [];
    const callback = (data) => {
        output.push(data);
    };
    session.outputListeners.add(callback);
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    session.outputListeners.delete(callback);
    return output.join("");
}
/**
 * Wait for a specific pattern in output
 */
export async function waitForPattern(session, pattern, options = {}) {
    const { timeout = 30000, includeMatch = true } = options;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return new Promise((resolve, reject) => {
        const output = [];
        const startTime = Date.now();
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout waiting for pattern: ${pattern}`));
        }, timeout);
        const callback = (data) => {
            output.push(data);
            const fullOutput = output.join("");
            const match = fullOutput.match(regex);
            if (match) {
                clearTimeout(timeoutId);
                cleanup();
                if (includeMatch) {
                    resolve(fullOutput);
                }
                else {
                    // Return output up to (not including) the match
                    const matchIndex = fullOutput.indexOf(match[0]);
                    resolve(fullOutput.substring(0, matchIndex));
                }
            }
        };
        const cleanup = () => {
            session.outputListeners.delete(callback);
        };
        session.outputListeners.add(callback);
    });
}
//# sourceMappingURL=streaming.js.map