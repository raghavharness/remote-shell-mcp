import { SharedSession } from "../../types.js";
import { EventEmitter } from "events";
/**
 * Share Manager - Session sharing for collaboration
 *
 * Manages shared session state and permissions.
 */
export declare class ShareManager extends EventEmitter {
    private shares;
    private sessionShares;
    private shareCounter;
    /**
     * Generate a unique share ID
     */
    private generateShareId;
    /**
     * Create a shared session
     */
    createShare(sessionId: string, permissions?: "view" | "control", options?: {
        password?: string;
        expiresInMs?: number;
    }): SharedSession;
    /**
     * Get a share by ID
     */
    getShare(shareId: string): SharedSession | null;
    /**
     * Get share for a session
     */
    getShareForSession(sessionId: string): SharedSession | null;
    /**
     * Remove a share
     */
    removeShare(shareId: string): boolean;
    /**
     * Remove share for a session
     */
    removeShareForSession(sessionId: string): boolean;
    /**
     * Validate password for a share
     */
    validatePassword(shareId: string, password: string): boolean;
    /**
     * Check if share requires password
     */
    requiresPassword(shareId: string): boolean;
    /**
     * Update permissions for a share
     */
    updatePermissions(shareId: string, permissions: "view" | "control"): boolean;
    /**
     * Extend share expiration
     */
    extendExpiration(shareId: string, additionalMs: number): boolean;
    /**
     * Increment connected clients count
     */
    clientConnected(shareId: string): void;
    /**
     * Decrement connected clients count
     */
    clientDisconnected(shareId: string): void;
    /**
     * Get all shares
     */
    getAllShares(): SharedSession[];
    /**
     * Get share count
     */
    getShareCount(): number;
    /**
     * Clean up expired shares
     */
    cleanupExpired(): number;
    /**
     * Check if a session is shared
     */
    isShared(sessionId: string): boolean;
    /**
     * Get share URL (base URL should be configured externally)
     */
    getShareUrl(shareId: string, baseUrl?: string): string;
}
export declare const shareManager: ShareManager;
//# sourceMappingURL=share-manager.d.ts.map