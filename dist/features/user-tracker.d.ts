import { ShellSession } from "../types.js";
/**
 * Tracks the current user in remote sessions.
 * Detects user changes from commands like sudo su, su, exit, etc.
 */
export declare class UserTracker {
    private userStack;
    /**
     * Initialize user tracking for a session
     */
    initSession(sessionId: string, initialUser?: string): void;
    /**
     * Get current user for a session
     */
    getCurrentUser(sessionId: string): string;
    /**
     * Set the current user (e.g., from whoami output)
     */
    setCurrentUser(sessionId: string, user: string): void;
    /**
     * Update user based on command execution
     */
    updateFromCommand(session: ShellSession, command: string, output: string): void;
    /**
     * Check if command is a user-switching command
     */
    private isSuCommand;
    /**
     * Extract target user from su command
     */
    private extractSuTarget;
    /**
     * Extract username from whoami output
     */
    private extractWhoamiOutput;
    /**
     * Try to extract username from shell prompt in output
     */
    private extractUserFromPrompt;
    /**
     * Broadcast user change to share clients
     */
    private broadcastUserChange;
    /**
     * Clean up session tracking
     */
    removeSession(sessionId: string): void;
    /**
     * Get user stack for debugging
     */
    getStack(sessionId: string): string[];
}
export declare const userTracker: UserTracker;
//# sourceMappingURL=user-tracker.d.ts.map