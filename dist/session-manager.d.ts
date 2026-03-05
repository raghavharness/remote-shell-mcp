import { ShellSession } from "./types.js";
export declare class SessionManager {
    private sessions;
    private activeSessionId;
    private sessionCounter;
    private cleanupInterval;
    private monitoringCleanups;
    constructor();
    /**
     * Generate a unique session ID
     */
    private generateSessionId;
    /**
     * Get all sessions
     */
    getAllSessions(): ShellSession[];
    /**
     * Get a specific session
     */
    getSession(sessionId: string): ShellSession | null;
    /**
     * Get the active session
     */
    getActiveSession(): ShellSession | null;
    /**
     * Get active session ID
     */
    getActiveSessionId(): string | null;
    /**
     * Set the active session
     */
    setActiveSession(sessionId: string): boolean;
    /**
     * Start a child process session
     */
    startChildProcessSession(command: string, args: string[], name: string, description: string, originalCommand: string, options?: {
        autoReconnect?: boolean;
    }): Promise<ShellSession>;
    /**
     * Start an SSH2 session
     */
    startSsh2Session(host: string, username: string, options?: {
        port?: number;
        password?: string;
        privateKeyPath?: string;
        passphrase?: string;
        autoReconnect?: boolean;
    }): Promise<ShellSession>;
    /**
     * Execute a command in an SSH2 session
     */
    execSsh2Command(session: ShellSession, command: string, timeout?: number): Promise<string>;
    /**
     * Execute a command in a child process session
     */
    execChildProcessCommand(session: ShellSession, command: string, waitTime?: number): Promise<string>;
    /**
     * Send interrupt signal to session (Ctrl+C)
     * Only writes \x03 to stdin - does NOT send SIGINT to child process
     * as that would kill the SSH connection instead of the remote command
     */
    sendInterrupt(session: ShellSession): Promise<string>;
    /**
     * Send a signal to session
     */
    sendSignal(session: ShellSession, signal: NodeJS.Signals): Promise<boolean>;
    /**
     * End a session
     */
    endSession(sessionId: string): Promise<boolean>;
    /**
     * End all sessions
     */
    endAllSessions(): Promise<number>;
    /**
     * Set TERM environment variable on the remote shell
     */
    private setRemoteTerm;
    /**
     * Update working directory by running pwd
     */
    private updateWorkingDirectory;
    /**
     * Update current user by running whoami
     */
    private updateCurrentUser;
    /**
     * Cleanup stale sessions
     */
    private cleanupStaleSessions;
    /**
     * Start periodic cleanup of stale sessions
     */
    private startStaleSessionCleanup;
    /**
     * Stop the cleanup interval
     */
    stopCleanup(): void;
    /**
     * Wait for connection to be established by detecting shell prompt or output
     */
    private waitForConnection;
    private sleep;
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session-manager.d.ts.map