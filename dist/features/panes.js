import { stripAnsi } from "../utils/ansi.js";
/**
 * Pane Manager - tmux-style pane management
 *
 * Allows multiple views within a single session:
 * - Split panes horizontally/vertically
 * - Independent command execution per pane
 * - Broadcast commands to all panes
 */
export class PaneManager {
    panes = new Map();
    sessionPanes = new Map(); // sessionId -> paneIds
    layouts = new Map(); // sessionId -> layout
    paneCounter = 0;
    /**
     * Initialize panes for a session (creates default pane-0)
     */
    initSession(sessionId) {
        const paneId = this.generatePaneId();
        const pane = {
            id: paneId,
            sessionId,
            name: "main",
            active: true,
            outputBuffer: [],
            commandHistory: [],
            workingDirectory: "~",
            outputListeners: new Set(),
        };
        this.panes.set(paneId, pane);
        this.sessionPanes.set(sessionId, [paneId]);
        this.layouts.set(sessionId, {
            type: "single",
            panes: [paneId],
        });
        return pane;
    }
    /**
     * Generate unique pane ID
     */
    generatePaneId() {
        return `pane-${this.paneCounter++}`;
    }
    /**
     * Get all panes for a session
     */
    getSessionPanes(sessionId) {
        const paneIds = this.sessionPanes.get(sessionId) || [];
        return paneIds
            .map(id => this.panes.get(id))
            .filter((p) => p !== undefined);
    }
    /**
     * Get a specific pane
     */
    getPane(paneId) {
        return this.panes.get(paneId) || null;
    }
    /**
     * Get active pane for a session
     */
    getActivePane(sessionId) {
        const panes = this.getSessionPanes(sessionId);
        return panes.find(p => p.active) || panes[0] || null;
    }
    /**
     * Set active pane
     */
    setActivePane(sessionId, paneId) {
        const panes = this.getSessionPanes(sessionId);
        const targetPane = panes.find(p => p.id === paneId);
        if (!targetPane)
            return false;
        // Deactivate all others
        for (const pane of panes) {
            pane.active = pane.id === paneId;
        }
        return true;
    }
    /**
     * Split a pane
     */
    splitPane(sessionId, direction, sourcePaneId) {
        const panes = this.getSessionPanes(sessionId);
        const sourcePane = sourcePaneId
            ? this.getPane(sourcePaneId)
            : this.getActivePane(sessionId);
        if (!sourcePane)
            return null;
        const newPaneId = this.generatePaneId();
        // Create new pane inheriting from source
        const newPane = {
            id: newPaneId,
            sessionId,
            name: `split-${panes.length}`,
            active: false,
            outputBuffer: [],
            commandHistory: [],
            workingDirectory: sourcePane.workingDirectory,
            outputListeners: new Set(),
        };
        this.panes.set(newPaneId, newPane);
        // Update session pane list
        const paneIds = this.sessionPanes.get(sessionId) || [];
        paneIds.push(newPaneId);
        this.sessionPanes.set(sessionId, paneIds);
        // Update layout
        const layout = this.layouts.get(sessionId);
        layout.panes.push(newPaneId);
        // Update layout type
        if (layout.type === "single") {
            layout.type = direction;
        }
        else if (layout.panes.length > 2) {
            layout.type = "grid";
        }
        return newPane;
    }
    /**
     * Close a pane
     */
    closePane(paneId) {
        const pane = this.panes.get(paneId);
        if (!pane)
            return false;
        const sessionId = pane.sessionId;
        const paneIds = this.sessionPanes.get(sessionId) || [];
        // Don't close if it's the only pane
        if (paneIds.length <= 1) {
            return false;
        }
        // Clean up pane
        pane.outputListeners.clear();
        if (pane.childProcess) {
            try {
                pane.childProcess.kill();
            }
            catch { }
        }
        // Remove from maps
        this.panes.delete(paneId);
        const newPaneIds = paneIds.filter(id => id !== paneId);
        this.sessionPanes.set(sessionId, newPaneIds);
        // Update layout
        const layout = this.layouts.get(sessionId);
        if (layout) {
            layout.panes = layout.panes.filter(id => id !== paneId);
            if (layout.panes.length === 1) {
                layout.type = "single";
            }
        }
        // If closed pane was active, activate another
        if (pane.active && newPaneIds.length > 0) {
            const nextPane = this.panes.get(newPaneIds[0]);
            if (nextPane)
                nextPane.active = true;
        }
        return true;
    }
    /**
     * Get layout for a session
     */
    getLayout(sessionId) {
        return this.layouts.get(sessionId) || null;
    }
    /**
     * Set layout type
     */
    setLayoutType(sessionId, type) {
        const layout = this.layouts.get(sessionId);
        if (!layout)
            return false;
        layout.type = type;
        return true;
    }
    /**
     * Execute command in a specific pane
     */
    async execInPane(paneId, command, execFn) {
        const pane = this.panes.get(paneId);
        if (!pane) {
            throw new Error(`Pane not found: ${paneId}`);
        }
        const output = await execFn(command, pane);
        // Record in pane history
        const historyEntry = {
            command,
            output: stripAnsi(output),
            timestamp: new Date(),
            workingDirectory: pane.workingDirectory,
        };
        pane.commandHistory.push(historyEntry);
        if (pane.commandHistory.length > 100) {
            pane.commandHistory.shift();
        }
        return output;
    }
    /**
     * Broadcast command to all panes in a session
     */
    async broadcastToSession(sessionId, command, execFn) {
        const panes = this.getSessionPanes(sessionId);
        const results = new Map();
        // Execute in parallel
        const promises = panes.map(async (pane) => {
            try {
                const output = await this.execInPane(pane.id, command, execFn);
                results.set(pane.id, output);
            }
            catch (err) {
                results.set(pane.id, `Error: ${err.message}`);
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Update pane working directory
     */
    updatePaneDirectory(paneId, directory) {
        const pane = this.panes.get(paneId);
        if (pane) {
            pane.workingDirectory = directory;
        }
    }
    /**
     * Rename a pane
     */
    renamePane(paneId, name) {
        const pane = this.panes.get(paneId);
        if (!pane)
            return false;
        pane.name = name;
        return true;
    }
    /**
     * Get pane count for session
     */
    getPaneCount(sessionId) {
        return this.sessionPanes.get(sessionId)?.length || 0;
    }
    /**
     * Clean up all panes for a session
     */
    clearSession(sessionId) {
        const paneIds = this.sessionPanes.get(sessionId) || [];
        for (const paneId of paneIds) {
            const pane = this.panes.get(paneId);
            if (pane) {
                pane.outputListeners.clear();
                if (pane.childProcess) {
                    try {
                        pane.childProcess.kill();
                    }
                    catch { }
                }
                this.panes.delete(paneId);
            }
        }
        this.sessionPanes.delete(sessionId);
        this.layouts.delete(sessionId);
        return paneIds.length;
    }
    /**
     * Get output from a pane
     */
    getPaneOutput(paneId, lines) {
        const pane = this.panes.get(paneId);
        if (!pane)
            return "";
        const buffer = pane.outputBuffer;
        if (lines) {
            return buffer.slice(-lines).join("");
        }
        return buffer.join("");
    }
    /**
     * Append output to a pane
     */
    appendOutput(paneId, output) {
        const pane = this.panes.get(paneId);
        if (!pane)
            return;
        pane.outputBuffer.push(output);
        // Trim buffer if too large
        if (pane.outputBuffer.length > 1000) {
            pane.outputBuffer = pane.outputBuffer.slice(-500);
        }
        // Notify listeners
        for (const listener of pane.outputListeners) {
            try {
                listener(output);
            }
            catch { }
        }
    }
    /**
     * Swap two panes
     */
    swapPanes(paneId1, paneId2) {
        const pane1 = this.panes.get(paneId1);
        const pane2 = this.panes.get(paneId2);
        if (!pane1 || !pane2 || pane1.sessionId !== pane2.sessionId) {
            return false;
        }
        const layout = this.layouts.get(pane1.sessionId);
        if (!layout)
            return false;
        const idx1 = layout.panes.indexOf(paneId1);
        const idx2 = layout.panes.indexOf(paneId2);
        if (idx1 === -1 || idx2 === -1)
            return false;
        // Swap in layout
        layout.panes[idx1] = paneId2;
        layout.panes[idx2] = paneId1;
        return true;
    }
    /**
     * Focus next pane
     */
    focusNext(sessionId) {
        const panes = this.getSessionPanes(sessionId);
        if (panes.length <= 1)
            return panes[0] || null;
        const activeIdx = panes.findIndex(p => p.active);
        const nextIdx = (activeIdx + 1) % panes.length;
        for (const pane of panes) {
            pane.active = false;
        }
        panes[nextIdx].active = true;
        return panes[nextIdx];
    }
    /**
     * Focus previous pane
     */
    focusPrev(sessionId) {
        const panes = this.getSessionPanes(sessionId);
        if (panes.length <= 1)
            return panes[0] || null;
        const activeIdx = panes.findIndex(p => p.active);
        const prevIdx = (activeIdx - 1 + panes.length) % panes.length;
        for (const pane of panes) {
            pane.active = false;
        }
        panes[prevIdx].active = true;
        return panes[prevIdx];
    }
}
// Singleton instance
export const paneManager = new PaneManager();
//# sourceMappingURL=panes.js.map