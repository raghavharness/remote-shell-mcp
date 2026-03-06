import { EventEmitter } from "events";
import { ShellSession, StreamingConfig, StreamEvent } from "../types.js";
/**
 * Real-time Stream Manager
 *
 * Provides true streaming output with:
 * - Real-time error pattern detection
 * - Interactive prompt detection
 * - Auto-interrupt on error (optional)
 * - Buffered output collection
 */
export declare class RealtimeStreamManager extends EventEmitter {
    private configs;
    private outputBuffers;
    private streamListeners;
    private pendingPrompts;
    private errorCounts;
    constructor();
    /**
     * Enable real-time streaming for a session
     */
    enableStreaming(session: ShellSession, config?: Partial<StreamingConfig>): () => void;
    /**
     * Disable streaming for a session
     */
    disableStreaming(sessionId: string): void;
    /**
     * Handle incoming output data
     */
    private handleOutput;
    /**
     * Auto-interrupt a session on error
     */
    private autoInterrupt;
    /**
     * Get pending prompt for a session
     */
    getPendingPrompt(sessionId: string): {
        prompt: string;
        type: string;
        detectedAt: Date;
    } | null;
    /**
     * Clear pending prompt after responding
     */
    clearPendingPrompt(sessionId: string): void;
    /**
     * Get error count for session
     */
    getErrorCount(sessionId: string): number;
    /**
     * Reset error count
     */
    resetErrorCount(sessionId: string): void;
    /**
     * Get buffered output
     */
    getBufferedOutput(sessionId: string): string;
    /**
     * Clear output buffer
     */
    clearBuffer(sessionId: string): void;
    /**
     * Check if streaming is enabled for session
     */
    isStreamingEnabled(sessionId: string): boolean;
    /**
     * Get streaming config for session
     */
    getConfig(sessionId: string): StreamingConfig | null;
    /**
     * Update streaming config
     */
    updateConfig(sessionId: string, updates: Partial<StreamingConfig>): boolean;
    /**
     * Add error pattern for a session
     */
    addErrorPattern(sessionId: string, pattern: RegExp): boolean;
    /**
     * Wait for output with streaming
     * Returns accumulated output, can be interrupted early on error
     */
    waitForOutput(session: ShellSession, options?: {
        timeout?: number;
        stopOnError?: boolean;
        stopOnPrompt?: boolean;
        stopPattern?: RegExp;
    }): Promise<{
        output: string;
        stoppedEarly: boolean;
        reason?: string;
    }>;
    /**
     * Stream output with callback for each chunk
     */
    streamWithCallback(session: ShellSession, callback: (event: StreamEvent) => void, options?: {
        timeout?: number;
        stopOnError?: boolean;
    }): () => void;
}
export declare const realtimeStream: RealtimeStreamManager;
//# sourceMappingURL=realtime-stream.d.ts.map