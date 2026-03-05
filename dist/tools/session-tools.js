import { sessionManager } from "../session-manager.js";
import { COLORS, formatOutputStart, formatOutputEnd } from "../utils/ansi.js";
import { directoryTracker } from "../features/directory-tracker.js";
import { outputSearch } from "../features/output-search.js";
/**
 * Handle session status tool
 */
export async function handleSessionStatus() {
    const sessions = sessionManager.getAllSessions();
    if (sessions.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `**No remote sessions**

Start a session by running an SSH command through the \`shell\` tool.`,
                },
            ],
        };
    }
    const activeId = sessionManager.getActiveSessionId();
    const statusLines = sessions.map((s) => {
        const active = activeId === s.id ? " **[ACTIVE]**" : "";
        const status = s.connected ? "Connected" : "Disconnected";
        const pwd = directoryTracker.getCurrentDirectory(s.id);
        return `- **${s.name}** (${s.id})${active}
  Status: ${status} | Commands: ${s.commandHistory.length} | Started: ${s.startedAt.toLocaleTimeString()}
  Working Dir: ${pwd}
  Port Forwards: ${s.portForwards.length}
  Auto-reconnect: ${s.autoReconnect ? "enabled" : "disabled"}
  Original: \`${s.originalCommand}\``;
    });
    return {
        content: [
            {
                type: "text",
                text: `**Remote Sessions (${sessions.length})**

${statusLines.join("\n\n")}`,
            },
        ],
    };
}
/**
 * Handle session switch tool
 */
export async function handleSessionSwitch(params) {
    const { sessionId } = params;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    sessionManager.setActiveSession(sessionId);
    return {
        content: [
            {
                type: "text",
                text: `**Switched to: ${session.name}**

Commands will now execute in this session.
Working directory: ${directoryTracker.getCurrentDirectory(sessionId)}`,
            },
        ],
    };
}
/**
 * Handle session end tool
 */
export async function handleSessionEnd(params) {
    let { sessionId } = params;
    if (sessionId === "all") {
        const count = await sessionManager.endAllSessions();
        return {
            content: [
                {
                    type: "text",
                    text: `**Ended ${count} session(s)**

You are now in the local shell.`,
                },
            ],
        };
    }
    if (!sessionId) {
        sessionId = sessionManager.getActiveSessionId() || undefined;
    }
    if (!sessionId) {
        return {
            content: [{ type: "text", text: "No active session to end." }],
        };
    }
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    const name = session.name;
    await sessionManager.endSession(sessionId);
    const activeSession = sessionManager.getActiveSession();
    return {
        content: [
            {
                type: "text",
                text: `**Ended session: ${name}**

${activeSession ? `Active session: ${activeSession.name}` : "You are now in the local shell."}`,
            },
        ],
    };
}
/**
 * Handle session history tool
 */
export async function handleSessionHistory(params) {
    const { sessionId, limit } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        throw new Error("No session found");
    }
    const history = session.commandHistory.slice(-(limit || 20));
    const historyText = history
        .map((h, i) => {
        const dir = h.workingDirectory ? ` (${h.workingDirectory})` : "";
        return `${i + 1}. \`${h.command}\`${dir} (${h.timestamp.toLocaleTimeString()})`;
    })
        .join("\n");
    return {
        content: [
            {
                type: "text",
                text: `**History for ${session.name}** (${history.length} commands)

${historyText || "No commands yet."}`,
            },
        ],
    };
}
/**
 * Handle session output tool
 */
export async function handleSessionOutput(params) {
    const { sessionId, lines } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        throw new Error("No session found");
    }
    const output = session.outputBuffer
        .join("")
        .split("\n")
        .slice(-(lines || 50))
        .join("\n");
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.bold}${COLORS.cyan}Output from ${session.name}${COLORS.reset}
${formatOutputStart()}
${output}
${formatOutputEnd()}`,
            },
        ],
    };
}
/**
 * Handle session signal tool
 */
export async function handleSessionSignal(params) {
    const { signal, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        throw new Error("No session found");
    }
    const signalMap = {
        SIGINT: "SIGINT",
        SIGTERM: "SIGTERM",
        SIGKILL: "SIGKILL",
        SIGHUP: "SIGHUP",
    };
    const nodeSignal = signalMap[signal];
    if (!nodeSignal) {
        throw new Error(`Unknown signal: ${signal}`);
    }
    const success = await sessionManager.sendSignal(session, nodeSignal);
    if (!success) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}Signal handling not supported for this session type.${COLORS.reset}`,
                },
            ],
        };
    }
    // Wait a moment and get output
    await new Promise((r) => setTimeout(r, 500));
    const recentOutput = session.outputBuffer.slice(-5).join("");
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.yellow}Sent ${signal} to session ${session.name}${COLORS.reset}

${recentOutput ? `${formatOutputStart()}\n${recentOutput}\n${formatOutputEnd()}` : ""}`,
            },
        ],
    };
}
/**
 * Handle output search tool
 */
export async function handleOutputSearch(params) {
    const { query, sessionId, regex, caseSensitive, limit, includeOutput } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        throw new Error("No session found");
    }
    const results = outputSearch.searchHistory(session, {
        query,
        regex: regex || false,
        caseSensitive: caseSensitive || false,
        limit: limit || 20,
        includeOutput: includeOutput || false,
    });
    if (results.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No matches found for: ${query}`,
                },
            ],
        };
    }
    const resultText = results
        .map((r, i) => {
        let text = `${i + 1}. \`${r.command}\` (${r.timestamp.toLocaleTimeString()})`;
        if (r.context) {
            text += `\n   Context: ${r.context.substring(0, 100)}...`;
        }
        return text;
    })
        .join("\n");
    return {
        content: [
            {
                type: "text",
                text: `**Search results for "${query}"** (${results.length} matches)

${resultText}`,
            },
        ],
    };
}
/**
 * Handle find errors tool
 */
export async function handleFindErrors(params) {
    const { sessionId, limit } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        throw new Error("No session found");
    }
    const errors = outputSearch.findErrors(session, limit || 10);
    if (errors.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.green}No errors found in session history.${COLORS.reset}`,
                },
            ],
        };
    }
    const errorText = errors
        .map((e, i) => {
        let text = `${i + 1}. \`${e.command}\``;
        if (e.context) {
            text += `\n   ${COLORS.red}${e.matchedText}${COLORS.reset}`;
        }
        return text;
    })
        .join("\n\n");
    return {
        content: [
            {
                type: "text",
                text: `**Errors found** (${errors.length})

${errorText}`,
            },
        ],
    };
}
/**
 * Get session tool definitions
 */
export function getSessionToolDefinitions() {
    return [
        {
            name: "remote_session_start",
            description: `Start a remote shell session with explicit parameters. Use for fine-grained control.

For most cases, prefer the \`shell\` tool which auto-detects remote commands.`,
            inputSchema: {
                type: "object",
                properties: {
                    method: {
                        type: "string",
                        enum: ["ssh", "gcloud", "aws", "azure", "custom"],
                        description: "Connection method",
                    },
                    host: { type: "string", description: "SSH hostname (for ssh)" },
                    username: { type: "string", description: "SSH user (for ssh)" },
                    port: { type: "number", description: "SSH port (default: 22)" },
                    password: { type: "string", description: "SSH password" },
                    privateKeyPath: { type: "string", description: "Path to SSH key" },
                    instance: { type: "string", description: "GCloud instance name" },
                    zone: { type: "string", description: "GCloud zone" },
                    project: { type: "string", description: "GCloud project" },
                    targetId: { type: "string", description: "AWS SSM target ID" },
                    region: { type: "string", description: "AWS region" },
                    vmName: { type: "string", description: "Azure VM name" },
                    resourceGroup: { type: "string", description: "Azure resource group" },
                    command: { type: "string", description: "Custom command" },
                    sessionName: { type: "string", description: "Friendly session name" },
                    autoReconnect: { type: "boolean", description: "Enable auto-reconnect (default: true)" },
                },
                required: ["method"],
            },
        },
        {
            name: "remote_session_status",
            description: "Get status of all remote sessions with working directory, port forwards, and auto-reconnect status.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "remote_session_switch",
            description: "Switch the active session when multiple sessions are open.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string", description: "Session ID to switch to" },
                },
                required: ["sessionId"],
            },
        },
        {
            name: "remote_session_end",
            description: "End remote session(s). Use sessionId='all' to end all sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string", description: "Session ID, 'all', or omit for active" },
                },
            },
        },
        {
            name: "remote_session_history",
            description: "Get command history for a session with working directories.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string", description: "Session ID (optional)" },
                    limit: { type: "number", description: "Max entries (default: 20)" },
                },
            },
        },
        {
            name: "remote_session_output",
            description: "Read recent raw output from session buffer.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string" },
                    lines: { type: "number", description: "Lines to show (default: 50)" },
                },
            },
        },
        {
            name: "remote_session_signal",
            description: "Send a signal to the session (SIGINT=Ctrl+C, SIGTERM, SIGKILL, SIGHUP).",
            inputSchema: {
                type: "object",
                properties: {
                    signal: {
                        type: "string",
                        enum: ["SIGINT", "SIGTERM", "SIGKILL", "SIGHUP"],
                        description: "Signal to send",
                    },
                    sessionId: { type: "string", description: "Session ID (optional)" },
                },
                required: ["signal"],
            },
        },
        {
            name: "remote_session_search",
            description: "Search through command history and output. Supports regex.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" },
                    sessionId: { type: "string", description: "Session ID (optional)" },
                    regex: { type: "boolean", description: "Use regex matching" },
                    caseSensitive: { type: "boolean", description: "Case sensitive search" },
                    limit: { type: "number", description: "Max results (default: 20)" },
                    includeOutput: { type: "boolean", description: "Search in command output too" },
                },
                required: ["query"],
            },
        },
        {
            name: "remote_session_errors",
            description: "Find error messages in session history (looks for 'error', 'failed', 'denied', etc.).",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string", description: "Session ID (optional)" },
                    limit: { type: "number", description: "Max errors to show (default: 10)" },
                },
            },
        },
    ];
}
//# sourceMappingURL=session-tools.js.map