import { PersistedSession, SessionState } from "../types.js";
/**
 * Session Persistence Manager
 *
 * Saves session state to disk for:
 * - Crash recovery
 * - Command replay on reconnect
 * - State restoration
 */
export declare class PersistenceManager {
    private persistDir;
    private enabled;
    constructor();
    private ensureDir;
    /**
     * Generate a persistence ID
     */
    generatePersistenceId(): string;
    /**
     * Save session state to disk
     */
    saveSession(session: PersistedSession): boolean;
    /**
     * Load session state from disk
     */
    loadSession(persistenceId: string): PersistedSession | null;
    /**
     * Delete session state from disk
     */
    deleteSession(persistenceId: string): boolean;
    /**
     * List all persisted sessions
     */
    listSessions(): PersistedSession[];
    /**
     * Update session state (partial update)
     */
    updateSessionState(persistenceId: string, state: Partial<SessionState>): boolean;
    /**
     * Add command to recent commands (for replay)
     */
    addRecentCommand(persistenceId: string, command: string, maxCommands?: number): boolean;
    /**
     * Get commands to replay on reconnect
     */
    getReplayCommands(persistenceId: string): string[];
    /**
     * Clean up stale persisted sessions
     */
    cleanupStale(maxAgeMs?: number): number;
    /**
     * Create initial session state
     */
    createInitialState(workingDirectory?: string): SessionState;
    /**
     * Create a persisted session record
     */
    createPersistedSession(id: string, originalCommand: string, name: string, workingDirectory?: string): PersistedSession;
    /**
     * Check if persistence is enabled
     */
    isEnabled(): boolean;
    /**
     * Get persistence directory path
     */
    getPersistDir(): string;
}
export declare const persistenceManager: PersistenceManager;
//# sourceMappingURL=persistence.d.ts.map