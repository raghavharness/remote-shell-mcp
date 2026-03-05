import { isCdCommand, extractCdTarget } from "../utils/patterns.js";
import { stripAnsi } from "../utils/ansi.js";
import path from "path";
import { shareManager } from "./sharing/share-manager.js";
import { shareServer } from "./sharing/ws-server.js";
export class DirectoryTracker {
    directoryStack = new Map();
    /**
     * Initialize directory tracking for a session
     */
    initSession(sessionId, initialDir = "~") {
        this.directoryStack.set(sessionId, [initialDir]);
    }
    /**
     * Get current working directory for a session
     */
    getCurrentDirectory(sessionId) {
        const stack = this.directoryStack.get(sessionId);
        if (!stack || stack.length === 0)
            return "~";
        return stack[stack.length - 1];
    }
    /**
     * Update directory based on command execution
     */
    updateFromCommand(session, command, output) {
        const sessionId = session.id;
        if (!this.directoryStack.has(sessionId)) {
            this.initSession(sessionId, session.workingDirectory || "~");
        }
        const stack = this.directoryStack.get(sessionId);
        const currentDir = stack[stack.length - 1];
        // Handle cd commands
        if (isCdCommand(command)) {
            const target = extractCdTarget(command);
            if (target === "__POPD__") {
                // popd - pop from stack
                if (stack.length > 1) {
                    stack.pop();
                }
            }
            else if (target) {
                // Regular cd or pushd
                const newDir = this.resolvePath(currentDir, target);
                if (command.trim().startsWith("pushd")) {
                    stack.push(newDir);
                }
                else {
                    // cd replaces current
                    stack[stack.length - 1] = newDir;
                }
            }
            // Update session
            session.workingDirectory = stack[stack.length - 1];
            // Broadcast directory change to share clients
            this.broadcastDirectoryChange(sessionId, session.workingDirectory);
        }
        // Try to extract from output if we see a prompt with path
        // Common patterns: user@host:/path$, [user@host path]$, etc.
        const pathFromPrompt = this.extractPathFromPrompt(output);
        if (pathFromPrompt && pathFromPrompt !== stack[stack.length - 1]) {
            stack[stack.length - 1] = pathFromPrompt;
            session.workingDirectory = pathFromPrompt;
            // Broadcast directory change to share clients
            this.broadcastDirectoryChange(sessionId, pathFromPrompt);
        }
    }
    /**
     * Broadcast directory change to share clients
     */
    broadcastDirectoryChange(sessionId, directory) {
        const share = shareManager.getShareForSession(sessionId);
        if (share) {
            shareServer.broadcastDirectoryChange(share.shareId, directory);
        }
    }
    /**
     * Force update from pwd command output
     */
    updateFromPwd(sessionId, pwdOutput) {
        const cleanOutput = stripAnsi(pwdOutput).trim();
        // Find path-like line in output
        const lines = cleanOutput.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("/") || trimmed.startsWith("~")) {
                const stack = this.directoryStack.get(sessionId);
                if (stack && stack[stack.length - 1] !== trimmed) {
                    stack[stack.length - 1] = trimmed;
                    // Broadcast directory change to share clients
                    this.broadcastDirectoryChange(sessionId, trimmed);
                }
                return;
            }
        }
    }
    /**
     * Resolve a path relative to current directory
     */
    resolvePath(currentDir, target) {
        // Handle ~ expansion
        if (target === "~" || target === "") {
            return "~";
        }
        if (target.startsWith("~/")) {
            return target;
        }
        // Handle absolute paths
        if (target.startsWith("/")) {
            return target;
        }
        // Handle - (previous directory) - we can't track this accurately
        if (target === "-") {
            return currentDir; // Best effort
        }
        // Handle .. and .
        if (currentDir === "~") {
            // Can't go above home without knowing actual path
            if (target === "..") {
                return "~";
            }
            return `~/${target}`;
        }
        // Relative path resolution
        const resolved = path.posix.resolve(currentDir, target);
        return resolved;
    }
    /**
     * Try to extract working directory from shell prompt
     */
    extractPathFromPrompt(output) {
        const cleanOutput = stripAnsi(output);
        // Common prompt patterns with paths
        const patterns = [
            // user@host:/path/to/dir$
            /[@:]\s*([\/~][^\s$#>]*)\s*[$#>]\s*$/m,
            // [user@host path]$
            /\[.*?\s+([\/~][^\]]*)\]\s*[$#>]\s*$/m,
            // (env) user@host:path$
            /:\s*([\/~][^\s$#>]*)\s*[$#>]\s*$/m,
        ];
        for (const pattern of patterns) {
            const match = cleanOutput.match(pattern);
            if (match && match[1]) {
                const path = match[1].trim();
                // Reject invalid paths:
                // - Paths starting with // (URLs like //www.w3.org)
                // - Paths containing quotes
                // - Paths containing HTML-like content
                if (path.startsWith("//") || path.includes('"') || path.includes("<") || path.includes(">")) {
                    continue;
                }
                return path;
            }
        }
        return null;
    }
    /**
     * Clean up session tracking
     */
    removeSession(sessionId) {
        this.directoryStack.delete(sessionId);
    }
    /**
     * Get directory stack for debugging
     */
    getStack(sessionId) {
        return [...(this.directoryStack.get(sessionId) || [])];
    }
}
// Singleton instance
export const directoryTracker = new DirectoryTracker();
//# sourceMappingURL=directory-tracker.js.map