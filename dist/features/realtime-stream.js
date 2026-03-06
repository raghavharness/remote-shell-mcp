import { EventEmitter } from "events";
import { sessionManager } from "../session-manager.js";
import { stripAnsi } from "../utils/ansi.js";
/**
 * Default error patterns to detect
 */
const DEFAULT_ERROR_PATTERNS = [
    /error:/i,
    /Error:/,
    /ERROR/,
    /failed/i,
    /FAILED/,
    /fatal:/i,
    /FATAL/,
    /exception/i,
    /Exception/,
    /panic:/i,
    /PANIC/,
    /segmentation fault/i,
    /permission denied/i,
    /access denied/i,
    /not found/i,
    /command not found/i,
    /no such file or directory/i,
    /connection refused/i,
    /connection timed out/i,
    /timeout/i,
    /\[ERROR\]/,
    /\[FATAL\]/,
    /npm ERR!/,
    /ENOENT/,
    /EACCES/,
    /EPERM/,
    /ETIMEDOUT/,
    /ECONNREFUSED/,
    /Traceback \(most recent call last\)/, // Python
    /at .+:\d+:\d+/, // JavaScript stack trace line
    /^\s+at /m, // Stack trace continuation
];
/**
 * Prompt patterns to detect interactive input requests
 */
const PROMPT_PATTERNS = [
    { pattern: /password[:\s]*$/i, type: "password" },
    { pattern: /passphrase[:\s]*$/i, type: "password" },
    { pattern: /\[y\/n\][:\s]*$/i, type: "confirmation" },
    { pattern: /\(yes\/no\)[:\s]*$/i, type: "confirmation" },
    { pattern: /\(y\/n\)[:\s]*$/i, type: "confirmation" },
    { pattern: /continue\?[:\s]*$/i, type: "confirmation" },
    { pattern: /proceed\?[:\s]*$/i, type: "confirmation" },
    { pattern: /overwrite[:\s]*.*\?[:\s]*$/i, type: "confirmation" },
    { pattern: /enter.*:/i, type: "text" },
    { pattern: /input.*:/i, type: "text" },
    { pattern: /> $/m, type: "text" }, // Generic prompt
];
/**
 * Real-time Stream Manager
 *
 * Provides true streaming output with:
 * - Real-time error pattern detection
 * - Interactive prompt detection
 * - Auto-interrupt on error (optional)
 * - Buffered output collection
 */
export class RealtimeStreamManager extends EventEmitter {
    configs = new Map();
    outputBuffers = new Map();
    streamListeners = new Map();
    pendingPrompts = new Map();
    errorCounts = new Map();
    constructor() {
        super();
    }
    /**
     * Enable real-time streaming for a session
     */
    enableStreaming(session, config = {}) {
        const fullConfig = {
            enabled: true,
            errorPatterns: [...DEFAULT_ERROR_PATTERNS, ...(config.errorPatterns || [])],
            autoInterrupt: config.autoInterrupt ?? false,
            bufferFlushInterval: config.bufferFlushInterval ?? 100,
            maxBufferSize: config.maxBufferSize ?? 8192,
        };
        this.configs.set(session.id, fullConfig);
        this.outputBuffers.set(session.id, []);
        this.errorCounts.set(session.id, 0);
        // Create listener for session output
        const listener = (data) => {
            this.handleOutput(session, data);
        };
        session.outputListeners.add(listener);
        this.streamListeners.set(session.id, listener);
        // Return cleanup function
        return () => {
            this.disableStreaming(session.id);
        };
    }
    /**
     * Disable streaming for a session
     */
    disableStreaming(sessionId) {
        const session = sessionManager.getSession(sessionId);
        const listener = this.streamListeners.get(sessionId);
        if (session && listener) {
            session.outputListeners.delete(listener);
        }
        this.configs.delete(sessionId);
        this.outputBuffers.delete(sessionId);
        this.streamListeners.delete(sessionId);
        this.pendingPrompts.delete(sessionId);
        this.errorCounts.delete(sessionId);
    }
    /**
     * Handle incoming output data
     */
    handleOutput(session, data) {
        const config = this.configs.get(session.id);
        if (!config?.enabled)
            return;
        // Add to buffer
        const buffer = this.outputBuffers.get(session.id) || [];
        buffer.push(data);
        // Trim buffer if too large
        const totalSize = buffer.reduce((sum, s) => sum + s.length, 0);
        if (totalSize > config.maxBufferSize) {
            while (buffer.length > 1 && buffer.reduce((sum, s) => sum + s.length, 0) > config.maxBufferSize / 2) {
                buffer.shift();
            }
        }
        this.outputBuffers.set(session.id, buffer);
        const strippedData = stripAnsi(data);
        // Emit raw output event
        const outputEvent = {
            type: "output",
            sessionId: session.id,
            data,
            timestamp: new Date(),
        };
        this.emit("output", outputEvent);
        // Check for errors
        for (const pattern of config.errorPatterns) {
            if (pattern.test(strippedData)) {
                const errorEvent = {
                    type: "error",
                    sessionId: session.id,
                    data,
                    timestamp: new Date(),
                    matchedPattern: pattern.toString(),
                };
                this.emit("error", errorEvent);
                // Increment error count
                const count = (this.errorCounts.get(session.id) || 0) + 1;
                this.errorCounts.set(session.id, count);
                // Auto-interrupt if enabled
                if (config.autoInterrupt) {
                    this.autoInterrupt(session);
                }
                break; // Only emit once per chunk
            }
        }
        // Check for prompts
        for (const { pattern, type } of PROMPT_PATTERNS) {
            if (pattern.test(strippedData)) {
                this.pendingPrompts.set(session.id, {
                    prompt: strippedData.trim().slice(-100), // Last 100 chars
                    type,
                    detectedAt: new Date(),
                });
                const promptEvent = {
                    type: "prompt",
                    sessionId: session.id,
                    data: strippedData,
                    timestamp: new Date(),
                };
                this.emit("prompt", promptEvent);
                break;
            }
        }
    }
    /**
     * Auto-interrupt a session on error
     */
    async autoInterrupt(session) {
        try {
            await sessionManager.sendInterrupt(session);
            const event = {
                type: "interrupted",
                sessionId: session.id,
                data: "Auto-interrupted due to error detection",
                timestamp: new Date(),
            };
            this.emit("interrupted", event);
        }
        catch (err) {
            console.error(`[stream] Failed to auto-interrupt session ${session.id}:`, err);
        }
    }
    /**
     * Get pending prompt for a session
     */
    getPendingPrompt(sessionId) {
        return this.pendingPrompts.get(sessionId) || null;
    }
    /**
     * Clear pending prompt after responding
     */
    clearPendingPrompt(sessionId) {
        this.pendingPrompts.delete(sessionId);
    }
    /**
     * Get error count for session
     */
    getErrorCount(sessionId) {
        return this.errorCounts.get(sessionId) || 0;
    }
    /**
     * Reset error count
     */
    resetErrorCount(sessionId) {
        this.errorCounts.set(sessionId, 0);
    }
    /**
     * Get buffered output
     */
    getBufferedOutput(sessionId) {
        const buffer = this.outputBuffers.get(sessionId) || [];
        return buffer.join("");
    }
    /**
     * Clear output buffer
     */
    clearBuffer(sessionId) {
        this.outputBuffers.set(sessionId, []);
    }
    /**
     * Check if streaming is enabled for session
     */
    isStreamingEnabled(sessionId) {
        return this.configs.get(sessionId)?.enabled ?? false;
    }
    /**
     * Get streaming config for session
     */
    getConfig(sessionId) {
        return this.configs.get(sessionId) || null;
    }
    /**
     * Update streaming config
     */
    updateConfig(sessionId, updates) {
        const config = this.configs.get(sessionId);
        if (!config)
            return false;
        Object.assign(config, updates);
        return true;
    }
    /**
     * Add error pattern for a session
     */
    addErrorPattern(sessionId, pattern) {
        const config = this.configs.get(sessionId);
        if (!config)
            return false;
        config.errorPatterns.push(pattern);
        return true;
    }
    /**
     * Wait for output with streaming
     * Returns accumulated output, can be interrupted early on error
     */
    async waitForOutput(session, options = {}) {
        const { timeout = 30000, stopOnError = false, stopOnPrompt = true, stopPattern, } = options;
        const startTime = Date.now();
        let stoppedEarly = false;
        let stopReason;
        // Clear buffer before starting
        this.clearBuffer(session.id);
        this.resetErrorCount(session.id);
        this.clearPendingPrompt(session.id);
        return new Promise((resolve) => {
            const checkStop = () => {
                // Check timeout
                if (Date.now() - startTime >= timeout) {
                    cleanup();
                    resolve({
                        output: this.getBufferedOutput(session.id),
                        stoppedEarly: false,
                    });
                    return;
                }
                // Check error
                if (stopOnError && this.getErrorCount(session.id) > 0) {
                    stoppedEarly = true;
                    stopReason = "error_detected";
                    cleanup();
                    resolve({
                        output: this.getBufferedOutput(session.id),
                        stoppedEarly,
                        reason: stopReason,
                    });
                    return;
                }
                // Check prompt
                if (stopOnPrompt && this.getPendingPrompt(session.id)) {
                    stoppedEarly = true;
                    stopReason = "prompt_detected";
                    cleanup();
                    resolve({
                        output: this.getBufferedOutput(session.id),
                        stoppedEarly,
                        reason: stopReason,
                    });
                    return;
                }
                // Check pattern
                if (stopPattern) {
                    const output = this.getBufferedOutput(session.id);
                    if (stopPattern.test(stripAnsi(output))) {
                        stoppedEarly = true;
                        stopReason = "pattern_matched";
                        cleanup();
                        resolve({
                            output,
                            stoppedEarly,
                            reason: stopReason,
                        });
                        return;
                    }
                }
            };
            const intervalId = setInterval(checkStop, 50);
            const cleanup = () => {
                clearInterval(intervalId);
            };
            // Also check immediately on output events for faster response
            const outputHandler = () => checkStop();
            this.on("output", outputHandler);
            this.on("error", outputHandler);
            this.on("prompt", outputHandler);
            // Cleanup listeners on resolve
            const originalResolve = resolve;
            const wrappedResolve = (result) => {
                this.off("output", outputHandler);
                this.off("error", outputHandler);
                this.off("prompt", outputHandler);
                originalResolve(result);
            };
        });
    }
    /**
     * Stream output with callback for each chunk
     */
    streamWithCallback(session, callback, options = {}) {
        const { timeout = 30000, stopOnError = false } = options;
        const startTime = Date.now();
        const outputHandler = (event) => {
            if (event.sessionId !== session.id)
                return;
            callback(event);
        };
        const errorHandler = (event) => {
            if (event.sessionId !== session.id)
                return;
            callback(event);
            if (stopOnError) {
                cleanup();
            }
        };
        this.on("output", outputHandler);
        this.on("error", errorHandler);
        this.on("prompt", outputHandler);
        const timeoutId = setTimeout(() => {
            cleanup();
            callback({
                type: "complete",
                sessionId: session.id,
                data: "Streaming timeout",
                timestamp: new Date(),
            });
        }, timeout);
        const cleanup = () => {
            clearTimeout(timeoutId);
            this.off("output", outputHandler);
            this.off("error", errorHandler);
            this.off("prompt", outputHandler);
        };
        return cleanup;
    }
}
// Singleton instance
export const realtimeStream = new RealtimeStreamManager();
//# sourceMappingURL=realtime-stream.js.map