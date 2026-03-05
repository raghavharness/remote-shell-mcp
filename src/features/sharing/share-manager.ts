import { SharedSession } from "../../types.js";
import { EventEmitter } from "events";

/**
 * Share Manager - Session sharing for collaboration
 *
 * Manages shared session state and permissions.
 */
export class ShareManager extends EventEmitter {
  private shares: Map<string, SharedSession> = new Map();
  private sessionShares: Map<string, string> = new Map(); // sessionId -> shareId
  private shareCounter = 0;

  /**
   * Generate a unique share ID
   */
  private generateShareId(): string {
    // Generate a short, URL-friendly ID
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Create a shared session
   */
  createShare(
    sessionId: string,
    permissions: "view" | "control" = "view",
    options: {
      password?: string;
      expiresInMs?: number;
    } = {}
  ): SharedSession {
    // Check if session is already shared
    const existingShareId = this.sessionShares.get(sessionId);
    if (existingShareId) {
      const existing = this.shares.get(existingShareId);
      if (existing) {
        return existing;
      }
    }

    const shareId = this.generateShareId();
    const expiresAt = new Date(Date.now() + (options.expiresInMs || 24 * 60 * 60 * 1000)); // Default 24h

    const share: SharedSession = {
      shareId,
      sessionId,
      permissions,
      expiresAt,
      password: options.password,
      connectedClients: 0,
      createdAt: new Date(),
    };

    this.shares.set(shareId, share);
    this.sessionShares.set(sessionId, shareId);

    this.emit("share-created", share);

    return share;
  }

  /**
   * Get a share by ID
   */
  getShare(shareId: string): SharedSession | null {
    const share = this.shares.get(shareId);
    if (!share) return null;

    // Check if expired
    if (new Date() > share.expiresAt) {
      this.removeShare(shareId);
      return null;
    }

    return share;
  }

  /**
   * Get share for a session
   */
  getShareForSession(sessionId: string): SharedSession | null {
    const shareId = this.sessionShares.get(sessionId);
    if (!shareId) return null;
    return this.getShare(shareId);
  }

  /**
   * Remove a share
   */
  removeShare(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;

    this.sessionShares.delete(share.sessionId);
    this.shares.delete(shareId);

    this.emit("share-removed", share);

    return true;
  }

  /**
   * Remove share for a session
   */
  removeShareForSession(sessionId: string): boolean {
    const shareId = this.sessionShares.get(sessionId);
    if (!shareId) return false;
    return this.removeShare(shareId);
  }

  /**
   * Validate password for a share
   */
  validatePassword(shareId: string, password: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;

    // No password required
    if (!share.password) return true;

    return share.password === password;
  }

  /**
   * Check if share requires password
   */
  requiresPassword(shareId: string): boolean {
    const share = this.shares.get(shareId);
    return share?.password !== undefined;
  }

  /**
   * Update permissions for a share
   */
  updatePermissions(shareId: string, permissions: "view" | "control"): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;

    share.permissions = permissions;
    this.emit("share-updated", share);

    return true;
  }

  /**
   * Extend share expiration
   */
  extendExpiration(shareId: string, additionalMs: number): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;

    share.expiresAt = new Date(share.expiresAt.getTime() + additionalMs);
    return true;
  }

  /**
   * Increment connected clients count
   */
  clientConnected(shareId: string): void {
    const share = this.shares.get(shareId);
    if (share) {
      share.connectedClients++;
      this.emit("client-connected", { shareId, count: share.connectedClients });
    }
  }

  /**
   * Decrement connected clients count
   */
  clientDisconnected(shareId: string): void {
    const share = this.shares.get(shareId);
    if (share && share.connectedClients > 0) {
      share.connectedClients--;
      this.emit("client-disconnected", { shareId, count: share.connectedClients });
    }
  }

  /**
   * Get all shares
   */
  getAllShares(): SharedSession[] {
    const now = new Date();
    const shares: SharedSession[] = [];

    for (const [shareId, share] of this.shares) {
      if (share.expiresAt > now) {
        shares.push(share);
      } else {
        // Clean up expired
        this.removeShare(shareId);
      }
    }

    return shares;
  }

  /**
   * Get share count
   */
  getShareCount(): number {
    return this.shares.size;
  }

  /**
   * Clean up expired shares
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [shareId, share] of this.shares) {
      if (share.expiresAt <= now) {
        this.removeShare(shareId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check if a session is shared
   */
  isShared(sessionId: string): boolean {
    return this.sessionShares.has(sessionId);
  }

  /**
   * Get share URL (base URL should be configured externally)
   */
  getShareUrl(shareId: string, baseUrl: string = "http://localhost:3847"): string {
    return `${baseUrl}/share/${shareId}`;
  }
}

// Singleton instance
export const shareManager = new ShareManager();
