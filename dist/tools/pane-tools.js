import { paneManager } from "../features/panes.js";
import { sessionManager } from "../session-manager.js";
import { COLORS } from "../utils/ansi.js";
import { ICONS } from "../utils/terminal-ui.js";
// ============================================================================
// Pane Tool Handlers
// ============================================================================
/**
 * Split the current pane
 */
export async function handlePaneSplit(params) {
    const { direction, sessionId, paneId } = params;
    const targetSessionId = sessionId || sessionManager.getActiveSessionId();
    if (!targetSessionId) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}No active session.${COLORS.reset} Start a remote session first.`,
                },
            ],
            isError: true,
        };
    }
    // Initialize panes for session if not already done
    let panes = paneManager.getSessionPanes(targetSessionId);
    if (panes.length === 0) {
        paneManager.initSession(targetSessionId);
    }
    const newPane = paneManager.splitPane(targetSessionId, direction, paneId);
    if (!newPane) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Failed to split pane.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const layout = paneManager.getLayout(targetSessionId);
    const session = sessionManager.getSession(targetSessionId);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Pane split ${direction}ly

${COLORS.cyan}New pane:${COLORS.reset} ${newPane.id}
${COLORS.cyan}Session:${COLORS.reset} ${session?.name || targetSessionId}
${COLORS.cyan}Layout:${COLORS.reset} ${layout?.type} (${layout?.panes.length} panes)
${COLORS.cyan}Working dir:${COLORS.reset} ${newPane.workingDirectory}

Use ${COLORS.bold}remote_pane_focus${COLORS.reset} to switch between panes.
Use ${COLORS.bold}remote_pane_exec${COLORS.reset} to run commands in a specific pane.`,
            },
        ],
    };
}
/**
 * Focus (switch to) a pane
 */
export async function handlePaneFocus(params) {
    const { paneId } = params;
    const pane = paneManager.getPane(paneId);
    if (!pane) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Pane not found: ${paneId}${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const success = paneManager.setActivePane(pane.sessionId, paneId);
    if (!success) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Failed to focus pane.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const session = sessionManager.getSession(pane.sessionId);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Focused pane: ${paneId}
${COLORS.cyan}Session:${COLORS.reset} ${session?.name}
${COLORS.cyan}Working dir:${COLORS.reset} ${pane.workingDirectory}
${COLORS.cyan}Commands:${COLORS.reset} ${pane.commandHistory.length}`,
            },
        ],
    };
}
/**
 * Close a pane
 */
export async function handlePaneClose(params) {
    const { paneId } = params;
    const pane = paneManager.getPane(paneId);
    if (!pane) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Pane not found: ${paneId}${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const sessionId = pane.sessionId;
    const paneCount = paneManager.getPaneCount(sessionId);
    if (paneCount <= 1) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}Cannot close the last pane.${COLORS.reset} Use //end to close the session.`,
                },
            ],
        };
    }
    const success = paneManager.closePane(paneId);
    if (!success) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Failed to close pane.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const remaining = paneManager.getPaneCount(sessionId);
    const activePane = paneManager.getActivePane(sessionId);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Closed pane: ${paneId}
${COLORS.cyan}Remaining panes:${COLORS.reset} ${remaining}
${COLORS.cyan}Active pane:${COLORS.reset} ${activePane?.id || "none"}`,
            },
        ],
    };
}
/**
 * List panes for a session
 */
export async function handlePaneList(params) {
    const { sessionId } = params;
    const targetSessionId = sessionId || sessionManager.getActiveSessionId();
    if (!targetSessionId) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active session.${COLORS.reset}`,
                },
            ],
        };
    }
    const panes = paneManager.getSessionPanes(targetSessionId);
    const layout = paneManager.getLayout(targetSessionId);
    const session = sessionManager.getSession(targetSessionId);
    if (panes.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No panes for session ${session?.name || targetSessionId}. Panes are created when you split.`,
                },
            ],
        };
    }
    const paneLines = panes.map(pane => {
        const active = pane.active ? ` ${COLORS.green}[ACTIVE]${COLORS.reset}` : "";
        const name = pane.name ? ` (${pane.name})` : "";
        return `${COLORS.cyan}${pane.id}${COLORS.reset}${name}${active}
  Dir: ${pane.workingDirectory}
  Commands: ${pane.commandHistory.length}
  Output buffer: ${pane.outputBuffer.length} chunks`;
    });
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.bold}Panes for ${session?.name || targetSessionId}${COLORS.reset}
Layout: ${layout?.type || "single"}

${paneLines.join("\n\n")}`,
            },
        ],
    };
}
/**
 * Execute command in a specific pane
 */
export async function handlePaneExec(params) {
    const { paneId, command } = params;
    const pane = paneManager.getPane(paneId);
    if (!pane) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Pane not found: ${paneId}${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const session = sessionManager.getSession(pane.sessionId);
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Session not found for pane.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    // Execute command (this is a simplified version - in real impl would need proper routing)
    // For now, we'll use the session's exec method
    let output;
    try {
        if (session.type === "ssh2") {
            output = await sessionManager.execSsh2Command(session, command);
        }
        else {
            output = await sessionManager.execChildProcessCommand(session, command);
        }
    }
    catch (err) {
        output = `Error: ${err.message}`;
    }
    // Store in pane history
    pane.commandHistory.push({
        command,
        output,
        timestamp: new Date(),
        workingDirectory: pane.workingDirectory,
    });
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.gray}[${paneId}]${COLORS.reset} ${COLORS.cyan}$${COLORS.reset} ${command}

${output}`,
            },
        ],
    };
}
/**
 * Broadcast command to all panes
 */
export async function handlePaneBroadcast(params) {
    const { command, sessionId } = params;
    const targetSessionId = sessionId || sessionManager.getActiveSessionId();
    if (!targetSessionId) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}No active session.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const panes = paneManager.getSessionPanes(targetSessionId);
    if (panes.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No panes to broadcast to.${COLORS.reset}`,
                },
            ],
        };
    }
    const session = sessionManager.getSession(targetSessionId);
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Session not found.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    // Execute in all panes
    const results = [];
    for (const pane of panes) {
        let output;
        try {
            if (session.type === "ssh2") {
                output = await sessionManager.execSsh2Command(session, command);
            }
            else {
                output = await sessionManager.execChildProcessCommand(session, command);
            }
        }
        catch (err) {
            output = `Error: ${err.message}`;
        }
        pane.commandHistory.push({
            command,
            output,
            timestamp: new Date(),
            workingDirectory: pane.workingDirectory,
        });
        results.push(`${COLORS.cyan}[${pane.id}]${COLORS.reset}
${output}`);
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.bold}Broadcast:${COLORS.reset} ${command}
${COLORS.gray}Sent to ${panes.length} pane(s)${COLORS.reset}

${results.join("\n\n")}`,
            },
        ],
    };
}
/**
 * Rename a pane
 */
export async function handlePaneRename(params) {
    const { paneId, name } = params;
    const success = paneManager.renamePane(paneId, name);
    if (!success) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}Pane not found: ${paneId}${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Renamed pane ${paneId} to "${name}"`,
            },
        ],
    };
}
/**
 * Focus next pane
 */
export async function handlePaneNext(params) {
    const { sessionId } = params;
    const targetSessionId = sessionId || sessionManager.getActiveSessionId();
    if (!targetSessionId) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}No active session.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    const nextPane = paneManager.focusNext(targetSessionId);
    if (!nextPane) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No panes to switch to.${COLORS.reset}`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Switched to pane: ${nextPane.id}${nextPane.name ? ` (${nextPane.name})` : ""}`,
            },
        ],
    };
}
// ============================================================================
// Tool Definitions
// ============================================================================
export function getPaneToolDefinitions() {
    return [
        {
            name: "remote_pane_split",
            description: `Split the current pane horizontally or vertically (tmux-style).

Creates a new pane within the session. Use for running multiple commands in parallel or monitoring.`,
            inputSchema: {
                type: "object",
                properties: {
                    direction: {
                        type: "string",
                        enum: ["horizontal", "vertical"],
                        description: "Split direction",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active)",
                    },
                    paneId: {
                        type: "string",
                        description: "Source pane to split (defaults to active pane)",
                    },
                },
                required: ["direction"],
            },
        },
        {
            name: "remote_pane_focus",
            description: "Switch to a specific pane.",
            inputSchema: {
                type: "object",
                properties: {
                    paneId: {
                        type: "string",
                        description: "Pane ID to focus",
                    },
                },
                required: ["paneId"],
            },
        },
        {
            name: "remote_pane_close",
            description: "Close a pane (cannot close the last pane).",
            inputSchema: {
                type: "object",
                properties: {
                    paneId: {
                        type: "string",
                        description: "Pane ID to close",
                    },
                },
                required: ["paneId"],
            },
        },
        {
            name: "remote_pane_list",
            description: "List all panes for a session.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active)",
                    },
                },
            },
        },
        {
            name: "remote_pane_exec",
            description: "Execute a command in a specific pane without switching focus.",
            inputSchema: {
                type: "object",
                properties: {
                    paneId: {
                        type: "string",
                        description: "Pane ID",
                    },
                    command: {
                        type: "string",
                        description: "Command to execute",
                    },
                },
                required: ["paneId", "command"],
            },
        },
        {
            name: "remote_pane_broadcast",
            description: `Broadcast a command to all panes in a session.

Useful for running the same command in multiple contexts simultaneously.`,
            inputSchema: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "Command to broadcast",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active)",
                    },
                },
                required: ["command"],
            },
        },
        {
            name: "remote_pane_rename",
            description: "Rename a pane for easier identification.",
            inputSchema: {
                type: "object",
                properties: {
                    paneId: {
                        type: "string",
                        description: "Pane ID",
                    },
                    name: {
                        type: "string",
                        description: "New name for the pane",
                    },
                },
                required: ["paneId", "name"],
            },
        },
        {
            name: "remote_pane_next",
            description: "Switch to the next pane in the session.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active)",
                    },
                },
            },
        },
    ];
}
//# sourceMappingURL=pane-tools.js.map