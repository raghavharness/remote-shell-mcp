import { stripAnsi } from "../utils/ansi.js";
import { shareManager } from "./sharing/share-manager.js";
import { shareServer } from "./sharing/ws-server.js";
/**
 * Tracks the current user in remote sessions.
 * Detects user changes from commands like sudo su, su, exit, etc.
 */
export class UserTracker {
    userStack = new Map();
    /**
     * Initialize user tracking for a session
     */
    initSession(sessionId, initialUser = "user") {
        this.userStack.set(sessionId, [initialUser]);
    }
    /**
     * Get current user for a session
     */
    getCurrentUser(sessionId) {
        const stack = this.userStack.get(sessionId);
        if (!stack || stack.length === 0)
            return "user";
        return stack[stack.length - 1];
    }
    /**
     * Set the current user (e.g., from whoami output)
     */
    setCurrentUser(sessionId, user) {
        const stack = this.userStack.get(sessionId);
        if (stack && stack.length > 0) {
            stack[stack.length - 1] = user;
        }
        else {
            this.userStack.set(sessionId, [user]);
        }
    }
    /**
     * Update user based on command execution
     */
    updateFromCommand(session, command, output) {
        const sessionId = session.id;
        const trimmedCmd = command.trim();
        if (!this.userStack.has(sessionId)) {
            this.initSession(sessionId);
        }
        const stack = this.userStack.get(sessionId);
        let userChanged = false;
        let newUser = stack[stack.length - 1];
        // Detect user-changing commands
        if (this.isSuCommand(trimmedCmd)) {
            // sudo su, sudo -i, sudo -s, su, su - username
            const targetUser = this.extractSuTarget(trimmedCmd);
            stack.push(targetUser);
            newUser = targetUser;
            userChanged = true;
        }
        else if (trimmedCmd === "exit" || trimmedCmd === "logout") {
            // Exiting from a su/sudo session pops the stack
            if (stack.length > 1) {
                stack.pop();
                newUser = stack[stack.length - 1];
                userChanged = true;
            }
        }
        else if (trimmedCmd === "whoami") {
            // Extract actual user from whoami output
            const detectedUser = this.extractWhoamiOutput(output);
            if (detectedUser && detectedUser !== stack[stack.length - 1]) {
                stack[stack.length - 1] = detectedUser;
                newUser = detectedUser;
                userChanged = true;
            }
        }
        // Try to detect user from prompt in output
        const promptUser = this.extractUserFromPrompt(output);
        if (promptUser && promptUser !== stack[stack.length - 1]) {
            stack[stack.length - 1] = promptUser;
            newUser = promptUser;
            userChanged = true;
        }
        // Broadcast user change to share clients
        if (userChanged) {
            this.broadcastUserChange(sessionId, newUser);
        }
    }
    /**
     * Check if command is a user-switching command
     */
    isSuCommand(command) {
        const patterns = [
            /^sudo\s+su\b/, // sudo su, sudo su -, sudo su username
            /^sudo\s+-i\b/, // sudo -i (login shell as root)
            /^sudo\s+-s\b/, // sudo -s (shell as root)
            /^su\s*$/, // su (switch to root)
            /^su\s+-/, // su - (login shell)
            /^su\s+\w+/, // su username
        ];
        return patterns.some(p => p.test(command));
    }
    /**
     * Extract target user from su command
     */
    extractSuTarget(command) {
        // sudo su - username or sudo su username
        const sudoSuMatch = command.match(/^sudo\s+su\s+(?:-\s+)?(\w+)/);
        if (sudoSuMatch) {
            return sudoSuMatch[1];
        }
        // sudo su, sudo su -, sudo -i, sudo -s -> root
        if (/^sudo\s+(su\b|-i\b|-s\b)/.test(command)) {
            return "root";
        }
        // su username or su - username
        const suMatch = command.match(/^su\s+(?:-\s+)?(\w+)/);
        if (suMatch) {
            return suMatch[1];
        }
        // plain su -> root
        if (/^su\s*$/.test(command) || /^su\s+-\s*$/.test(command)) {
            return "root";
        }
        return "root";
    }
    /**
     * Extract username from whoami output
     */
    extractWhoamiOutput(output) {
        const cleanOutput = stripAnsi(output).trim();
        const lines = cleanOutput.split("\n");
        // Find a line that looks like just a username (single word, no special chars)
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip the command echo and prompts
            if (trimmed === "whoami" || trimmed.includes("$") || trimmed.includes("#")) {
                continue;
            }
            // Valid username: alphanumeric, underscore, hyphen, starts with letter or underscore
            if (/^[a-z_][a-z0-9_-]*$/.test(trimmed)) {
                return trimmed;
            }
        }
        return null;
    }
    /**
     * Try to extract username from shell prompt in output
     */
    extractUserFromPrompt(output) {
        const cleanOutput = stripAnsi(output);
        // Common prompt patterns
        const patterns = [
            // user@host:path$ or user@host:path# or user@host:path%
            /^([a-z_][a-z0-9_-]*)@[\w.-]+:/m,
            // [user@host path]$ or [user@host path]# or [user@host path]%
            /^\[([a-z_][a-z0-9_-]*)@[\w.-]+\s/m,
            // user@host $ or user@host # or user@host %
            /^([a-z_][a-z0-9_-]*)@[\w.-]+\s*[$#%]\s*$/m,
            // user@host dir % (zsh/Mac style - space separated)
            /^([a-z_][a-z0-9_-]*)@[\w.-]+\s+[~\/]\S*\s*[$#%]\s*$/m,
        ];
        for (const pattern of patterns) {
            const match = cleanOutput.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * Broadcast user change to share clients
     */
    broadcastUserChange(sessionId, user) {
        const share = shareManager.getShareForSession(sessionId);
        if (share) {
            shareServer.broadcastUserChange(share.shareId, user);
        }
    }
    /**
     * Clean up session tracking
     */
    removeSession(sessionId) {
        this.userStack.delete(sessionId);
    }
    /**
     * Get user stack for debugging
     */
    getStack(sessionId) {
        return [...(this.userStack.get(sessionId) || [])];
    }
}
// Singleton instance
export const userTracker = new UserTracker();
//# sourceMappingURL=user-tracker.js.map