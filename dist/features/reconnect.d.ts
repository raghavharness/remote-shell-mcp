import { ShellSession } from "../types.js";
import { EventEmitter } from "events";
export interface ReconnectOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}
export declare class ReconnectManager extends EventEmitter {
    private reconnecting;
    private options;
    constructor(options?: Partial<ReconnectOptions>);
    /**
     * Check if a session is disconnected
     */
    isDisconnected(session: ShellSession): boolean;
    /**
     * Attempt to reconnect a session
     */
    reconnect(session: ShellSession): Promise<boolean>;
    /**
     * Attempt a single reconnection
     */
    private attemptReconnect;
    /**
     * Reconnect a child process session
     */
    private reconnectChildProcess;
    /**
     * Reconnect an SSH2 session
     */
    private reconnectSsh2;
    /**
     * Parse connection info from session
     */
    private parseConnectionInfo;
    /**
     * Monitor a session for disconnection
     */
    startMonitoring(session: ShellSession, checkInterval?: number): () => void;
    /**
     * Stop reconnection attempts for a session
     */
    stopReconnect(sessionId: string): void;
    private sleep;
}
export declare const reconnectManager: ReconnectManager;
//# sourceMappingURL=reconnect.d.ts.map