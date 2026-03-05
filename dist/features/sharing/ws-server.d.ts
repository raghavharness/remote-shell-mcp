import { EventEmitter } from "events";
/**
 * WebSocket Server for session sharing
 *
 * Provides real-time terminal sharing capabilities:
 * - View-only mode: See terminal output
 * - Control mode: Send commands
 */
export declare class ShareServer extends EventEmitter {
    private httpServer;
    private wsServer;
    private clients;
    private port;
    private running;
    /**
     * Start the share server
     */
    start(port?: number): Promise<void>;
    /**
     * Stop the share server
     */
    stop(): Promise<void>;
    /**
     * Handle HTTP requests
     */
    private handleHttpRequest;
    /**
     * Handle WebSocket connection
     */
    private handleConnection;
    /**
     * Handle incoming message from client
     */
    private handleMessage;
    /**
     * Handle authentication
     */
    private handleAuth;
    /**
     * Handle interrupt signal (Ctrl+C) from client
     */
    private handleInterrupt;
    /**
     * Handle EOF signal (Ctrl+D) from client
     */
    private handleEof;
    /**
     * Handle command from client (control mode only)
     */
    private handleCommand;
    /**
     * Handle tab completion request from client
     */
    private handleTabComplete;
    /**
     * Handle raw input from client (for interactive prompts like passwords, confirmations)
     */
    private handleRawInput;
    /**
     * Get session context for terminal prompt
     */
    private getSessionContext;
    /**
     * Send recent output history to a client
     */
    private sendOutputHistory;
    /**
     * Broadcast directory change to all clients
     */
    broadcastDirectoryChange(shareId: string, directory: string): void;
    /**
     * Broadcast user change to all clients
     */
    broadcastUserChange(shareId: string, user: string): void;
    /**
     * Broadcast command completion to all clients (for prompt rendering)
     */
    broadcastCommandComplete(shareId: string): void;
    /**
     * Broadcast full context update to all clients
     */
    broadcastContextUpdate(shareId: string, context: {
        user?: string;
        hostname?: string;
        directory?: string;
    }): void;
    /**
     * Broadcast session ended to all clients and close their connections
     */
    broadcastSessionEnded(shareId: string, reason?: string): void;
    /**
     * Broadcast share removed to all clients
     */
    broadcastShareRemoved(shareId: string): void;
    /**
     * Broadcast output to all clients of a share
     */
    broadcastOutput(shareId: string, output: string, isStderr?: boolean): void;
    /**
     * Send message to client
     */
    private sendToClient;
    /**
     * Get the share HTML page with xterm.js terminal emulator
     */
    private getShareHtml;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * Get server port
     */
    getPort(): number;
    /**
     * Get connected client count for a share
     */
    getClientCount(shareId: string): number;
}
export declare const shareServer: ShareServer;
//# sourceMappingURL=ws-server.d.ts.map