import { ShellSession } from "../types.js";
import { EventEmitter } from "events";
export interface StreamingOutput {
    sessionId: string;
    data: string;
    timestamp: Date;
    isError: boolean;
}
export declare class OutputStreamer extends EventEmitter {
    private activeStreams;
    /**
     * Register a listener for streaming output
     */
    subscribe(session: ShellSession, callback: (output: StreamingOutput) => void): () => void;
    /**
     * Get pending output that hasn't been streamed yet
     */
    getPendingOutput(session: ShellSession): string;
    /**
     * Check if a session has active stream listeners
     */
    hasListeners(sessionId: string): boolean;
    /**
     * Get number of active listeners for a session
     */
    getListenerCount(sessionId: string): number;
    /**
     * Remove all listeners for a session
     */
    clearSessionListeners(session: ShellSession): void;
    /**
     * Broadcast output to all listeners
     */
    broadcast(session: ShellSession, data: string, isError?: boolean): void;
}
export declare const outputStreamer: OutputStreamer;
/**
 * Async generator for streaming output
 */
export declare function streamOutput(session: ShellSession, options?: {
    timeout?: number;
    bufferSize?: number;
}): AsyncGenerator<string, void, unknown>;
/**
 * Collect output for a specified duration
 */
export declare function collectOutput(session: ShellSession, durationMs: number): Promise<string>;
/**
 * Wait for a specific pattern in output
 */
export declare function waitForPattern(session: ShellSession, pattern: RegExp | string, options?: {
    timeout?: number;
    includeMatch?: boolean;
}): Promise<string>;
//# sourceMappingURL=streaming.d.ts.map