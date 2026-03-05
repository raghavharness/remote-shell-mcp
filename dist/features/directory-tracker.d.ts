import { ShellSession } from "../types.js";
export declare class DirectoryTracker {
    private directoryStack;
    /**
     * Initialize directory tracking for a session
     */
    initSession(sessionId: string, initialDir?: string): void;
    /**
     * Get current working directory for a session
     */
    getCurrentDirectory(sessionId: string): string;
    /**
     * Update directory based on command execution
     */
    updateFromCommand(session: ShellSession, command: string, output: string): void;
    /**
     * Force update from pwd command output
     */
    updateFromPwd(sessionId: string, pwdOutput: string): void;
    /**
     * Resolve a path relative to current directory
     */
    private resolvePath;
    /**
     * Try to extract working directory from shell prompt
     */
    private extractPathFromPrompt;
    /**
     * Clean up session tracking
     */
    removeSession(sessionId: string): void;
    /**
     * Get directory stack for debugging
     */
    getStack(sessionId: string): string[];
}
export declare const directoryTracker: DirectoryTracker;
//# sourceMappingURL=directory-tracker.d.ts.map