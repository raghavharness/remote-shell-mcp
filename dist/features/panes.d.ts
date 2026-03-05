import { SessionPane, PaneLayout, PaneLayoutType } from "../types.js";
/**
 * Pane Manager - tmux-style pane management
 *
 * Allows multiple views within a single session:
 * - Split panes horizontally/vertically
 * - Independent command execution per pane
 * - Broadcast commands to all panes
 */
export declare class PaneManager {
    private panes;
    private sessionPanes;
    private layouts;
    private paneCounter;
    /**
     * Initialize panes for a session (creates default pane-0)
     */
    initSession(sessionId: string): SessionPane;
    /**
     * Generate unique pane ID
     */
    private generatePaneId;
    /**
     * Get all panes for a session
     */
    getSessionPanes(sessionId: string): SessionPane[];
    /**
     * Get a specific pane
     */
    getPane(paneId: string): SessionPane | null;
    /**
     * Get active pane for a session
     */
    getActivePane(sessionId: string): SessionPane | null;
    /**
     * Set active pane
     */
    setActivePane(sessionId: string, paneId: string): boolean;
    /**
     * Split a pane
     */
    splitPane(sessionId: string, direction: "horizontal" | "vertical", sourcePaneId?: string): SessionPane | null;
    /**
     * Close a pane
     */
    closePane(paneId: string): boolean;
    /**
     * Get layout for a session
     */
    getLayout(sessionId: string): PaneLayout | null;
    /**
     * Set layout type
     */
    setLayoutType(sessionId: string, type: PaneLayoutType): boolean;
    /**
     * Execute command in a specific pane
     */
    execInPane(paneId: string, command: string, execFn: (command: string, pane: SessionPane) => Promise<string>): Promise<string>;
    /**
     * Broadcast command to all panes in a session
     */
    broadcastToSession(sessionId: string, command: string, execFn: (command: string, pane: SessionPane) => Promise<string>): Promise<Map<string, string>>;
    /**
     * Update pane working directory
     */
    updatePaneDirectory(paneId: string, directory: string): void;
    /**
     * Rename a pane
     */
    renamePane(paneId: string, name: string): boolean;
    /**
     * Get pane count for session
     */
    getPaneCount(sessionId: string): number;
    /**
     * Clean up all panes for a session
     */
    clearSession(sessionId: string): number;
    /**
     * Get output from a pane
     */
    getPaneOutput(paneId: string, lines?: number): string;
    /**
     * Append output to a pane
     */
    appendOutput(paneId: string, output: string): void;
    /**
     * Swap two panes
     */
    swapPanes(paneId1: string, paneId2: string): boolean;
    /**
     * Focus next pane
     */
    focusNext(sessionId: string): SessionPane | null;
    /**
     * Focus previous pane
     */
    focusPrev(sessionId: string): SessionPane | null;
}
export declare const paneManager: PaneManager;
//# sourceMappingURL=panes.d.ts.map