import { sessionManager } from "../session-manager.js";
import { portForwarder } from "../features/port-forward.js";
import { COLORS, formatSuccess, formatError, formatInfo, formatWarning } from "../utils/ansi.js";
/**
 * Handle start local port forward
 */
export async function handleStartLocalForward(params) {
    const { localPort, remoteHost = "localhost", remotePort, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No active session. Connect to a remote server first.") }],
            isError: true,
        };
    }
    try {
        const forward = await portForwarder.startLocalForward(session, {
            type: "local",
            localPort,
            remoteHost,
            remotePort,
        });
        return {
            content: [
                {
                    type: "text",
                    text: `${formatSuccess("Local port forward started")}

${COLORS.cyan}Forward ID:${COLORS.reset}  ${forward.id}
${COLORS.cyan}Type:${COLORS.reset}        Local (L)
${COLORS.cyan}Local:${COLORS.reset}       localhost:${localPort}
${COLORS.cyan}Remote:${COLORS.reset}      ${remoteHost}:${remotePort}

${COLORS.green}→${COLORS.reset} Connections to ${COLORS.bold}localhost:${localPort}${COLORS.reset} will be forwarded to ${COLORS.bold}${remoteHost}:${remotePort}${COLORS.reset} on the remote server.

${formatInfo("Use remote_port_stop to close this forward.")}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: formatError(error.message) }],
            isError: true,
        };
    }
}
/**
 * Handle start remote port forward
 */
export async function handleStartRemoteForward(params) {
    const { remotePort, localHost = "localhost", localPort, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No active session. Connect to a remote server first.") }],
            isError: true,
        };
    }
    if (session.type !== "ssh2") {
        return {
            content: [{ type: "text", text: formatError("Remote port forwarding requires an SSH2 session. Use direct SSH connection.") }],
            isError: true,
        };
    }
    try {
        const forward = await portForwarder.startRemoteForward(session, {
            type: "remote",
            localPort,
            remoteHost: localHost,
            remotePort,
        });
        return {
            content: [
                {
                    type: "text",
                    text: `${formatSuccess("Remote port forward started")}

${COLORS.cyan}Forward ID:${COLORS.reset}  ${forward.id}
${COLORS.cyan}Type:${COLORS.reset}        Remote (R)
${COLORS.cyan}Remote:${COLORS.reset}      *:${remotePort} (on remote server)
${COLORS.cyan}Local:${COLORS.reset}       ${localHost}:${localPort}

${COLORS.green}←${COLORS.reset} Connections to port ${COLORS.bold}${remotePort}${COLORS.reset} on the remote server will be forwarded to ${COLORS.bold}${localHost}:${localPort}${COLORS.reset} on your local machine.

${formatInfo("Use remote_port_stop to close this forward.")}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: formatError(error.message) }],
            isError: true,
        };
    }
}
/**
 * Handle list port forwards
 */
export async function handleListPortForwards(params) {
    const { sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        // List from all sessions
        const sessions = sessionManager.getAllSessions();
        const allForwards = [];
        for (const s of sessions) {
            for (const f of s.portForwards) {
                allForwards.push({ session: s.name, forward: f });
            }
        }
        if (allForwards.length === 0) {
            return {
                content: [{ type: "text", text: formatInfo("No active port forwards.") }],
            };
        }
        const lines = allForwards.map(({ session, forward }) => formatForwardLine(forward, session));
        return {
            content: [
                {
                    type: "text",
                    text: `**Active Port Forwards (${allForwards.length})**

${lines.join("\n")}`,
                },
            ],
        };
    }
    const forwards = portForwarder.listForwards(session);
    if (forwards.length === 0) {
        return {
            content: [{ type: "text", text: formatInfo(`No port forwards for session ${session.name}.`) }],
        };
    }
    const lines = forwards.map((f) => formatForwardLine(f));
    return {
        content: [
            {
                type: "text",
                text: `**Port Forwards for ${session.name}** (${forwards.length})

${lines.join("\n")}`,
            },
        ],
    };
}
/**
 * Handle stop port forward
 */
export async function handleStopPortForward(params) {
    const { forwardId, sessionId } = params;
    // Find the session with this forward
    let session = sessionId ? sessionManager.getSession(sessionId) : null;
    if (!session) {
        // Search all sessions
        for (const s of sessionManager.getAllSessions()) {
            if (s.portForwards.some((f) => f.id === forwardId)) {
                session = s;
                break;
            }
        }
    }
    if (!session) {
        session = sessionManager.getActiveSession();
    }
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No session found with this forward.") }],
            isError: true,
        };
    }
    const stopped = await portForwarder.stopForward(session, forwardId);
    if (stopped) {
        return {
            content: [{ type: "text", text: formatSuccess(`Port forward ${forwardId} stopped.`) }],
        };
    }
    return {
        content: [{ type: "text", text: formatWarning(`Port forward ${forwardId} not found or already stopped.`) }],
    };
}
/**
 * Handle stop all port forwards
 */
export async function handleStopAllPortForwards(params) {
    const { sessionId } = params;
    if (sessionId === "all" || !sessionId) {
        let total = 0;
        for (const session of sessionManager.getAllSessions()) {
            const count = await portForwarder.stopAllForwards(session);
            total += count;
        }
        return {
            content: [{ type: "text", text: formatSuccess(`Stopped ${total} port forward(s).`) }],
        };
    }
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        return {
            content: [{ type: "text", text: formatError(`Session not found: ${sessionId}`) }],
            isError: true,
        };
    }
    const count = await portForwarder.stopAllForwards(session);
    return {
        content: [{ type: "text", text: formatSuccess(`Stopped ${count} port forward(s) for ${session.name}.`) }],
    };
}
/**
 * Format a port forward for display
 */
function formatForwardLine(forward, sessionName) {
    const status = forward.active
        ? `${COLORS.green}●${COLORS.reset}`
        : `${COLORS.red}○${COLORS.reset}`;
    const type = forward.type === "local" ? "L" : forward.type === "remote" ? "R" : "D";
    let description;
    if (forward.type === "local") {
        description = `localhost:${forward.localPort} → ${forward.remoteHost}:${forward.remotePort}`;
    }
    else if (forward.type === "remote") {
        description = `*:${forward.remotePort} → localhost:${forward.localPort}`;
    }
    else {
        description = `SOCKS localhost:${forward.localPort}`;
    }
    const sessionInfo = sessionName ? ` (${sessionName})` : "";
    return `${status} ${forward.id} [${type}] ${description}${sessionInfo}`;
}
/**
 * Get port tool definitions
 */
export function getPortToolDefinitions() {
    return [
        {
            name: "remote_port_forward_local",
            description: `Start a LOCAL port forward (SSH -L style).

Listens on a local port and forwards connections to a port on the remote server.

Example: Access a database running on the remote server:
- localPort: 5433
- remoteHost: localhost
- remotePort: 5432
→ Connect to localhost:5433 to access the remote PostgreSQL`,
            inputSchema: {
                type: "object",
                properties: {
                    localPort: {
                        type: "number",
                        description: "Local port to listen on",
                    },
                    remoteHost: {
                        type: "string",
                        description: "Remote host to forward to (default: localhost)",
                    },
                    remotePort: {
                        type: "number",
                        description: "Remote port to forward to",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional)",
                    },
                },
                required: ["localPort", "remotePort"],
            },
        },
        {
            name: "remote_port_forward_remote",
            description: `Start a REMOTE port forward (SSH -R style).

Listens on a port on the remote server and forwards connections back to your local machine.
Requires SSH2 session type.

Example: Expose a local dev server to the remote:
- remotePort: 8080
- localPort: 3000
→ Remote server port 8080 forwards to your localhost:3000`,
            inputSchema: {
                type: "object",
                properties: {
                    remotePort: {
                        type: "number",
                        description: "Remote port to listen on",
                    },
                    localHost: {
                        type: "string",
                        description: "Local host to forward to (default: localhost)",
                    },
                    localPort: {
                        type: "number",
                        description: "Local port to forward to",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional)",
                    },
                },
                required: ["remotePort", "localPort"],
            },
        },
        {
            name: "remote_port_list",
            description: "List all active port forwards.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID to filter (optional, shows all if omitted)",
                    },
                },
            },
        },
        {
            name: "remote_port_stop",
            description: "Stop a specific port forward by ID.",
            inputSchema: {
                type: "object",
                properties: {
                    forwardId: {
                        type: "string",
                        description: "Forward ID (e.g., fwd-1)",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional)",
                    },
                },
                required: ["forwardId"],
            },
        },
        {
            name: "remote_port_stop_all",
            description: "Stop all port forwards for a session or all sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID, or 'all' to stop all forwards",
                    },
                },
            },
        },
    ];
}
//# sourceMappingURL=port-tools.js.map