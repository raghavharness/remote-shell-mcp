import { sessionManager } from "../session-manager.js";
import { directoryTracker } from "../features/directory-tracker.js";
// Prompt aliases - map alternative names to canonical prompts
const PROMPT_ALIASES = {
    // Exit session aliases (matches //end, //exit, //quit, //close, //disconnect, ~.)
    "end": "end-session",
    "exit": "end-session",
    "quit": "end-session",
    "close": "end-session",
    "disconnect": "end-session",
    // Interrupt aliases (matches //stop, //kill, //interrupt, //ctrl-c, ~c)
    "kill": "stop",
    "interrupt": "stop",
    "ctrl-c": "stop",
    "ctrlc": "stop",
    "sigint": "stop",
};
/**
 * Get prompt definitions
 */
export function getPromptDefinitions() {
    return [
        // === SESSION EXIT (matches: ~., //end, //exit, //quit, //close, //disconnect) ===
        {
            name: "end-session",
            description: "End the current remote shell session or all sessions. Aliases: end, exit, quit, close, disconnect",
            arguments: [
                {
                    name: "sessionId",
                    description: "Session ID to end, or 'all' to end all sessions. Defaults to active session.",
                    required: false,
                },
            ],
        },
        {
            name: "end",
            description: "Alias for end-session. End the current remote shell session.",
        },
        {
            name: "exit",
            description: "Alias for end-session. End the current remote shell session.",
        },
        {
            name: "quit",
            description: "Alias for end-session. End the current remote shell session.",
        },
        {
            name: "close",
            description: "Alias for end-session. End the current remote shell session.",
        },
        {
            name: "disconnect",
            description: "Alias for end-session. End the current remote shell session.",
        },
        // === INTERRUPT (matches: //stop, //kill, //interrupt, //ctrl-c, ~c) ===
        {
            name: "stop",
            description: "Send Ctrl+C (SIGINT) to interrupt the current command. Aliases: kill, interrupt, ctrl-c",
        },
        {
            name: "kill",
            description: "Alias for stop. Send Ctrl+C (SIGINT) to interrupt the current command.",
        },
        {
            name: "interrupt",
            description: "Alias for stop. Send Ctrl+C (SIGINT) to interrupt the current command.",
        },
        {
            name: "ctrl-c",
            description: "Alias for stop. Send Ctrl+C (SIGINT) to interrupt the current command.",
        },
        // === SESSION MANAGEMENT ===
        {
            name: "session-status",
            description: "Show status of all remote shell sessions",
        },
        {
            name: "switch-session",
            description: "Switch to a different remote shell session",
            arguments: [
                {
                    name: "sessionId",
                    description: "Session ID to switch to",
                    required: true,
                },
            ],
        },
        {
            name: "session-history",
            description: "Show command history for a session",
            arguments: [
                {
                    name: "sessionId",
                    description: "Session ID (defaults to active session)",
                    required: false,
                },
                {
                    name: "limit",
                    description: "Number of commands to show (default: 20)",
                    required: false,
                },
            ],
        },
        {
            name: "exit-nested",
            description: "Exit a nested shell (inner SSH, sudo, docker exec, etc.) without killing the main session",
        },
        {
            name: "new-session",
            description: "Start a new parallel SSH session without running inside the current active session",
            arguments: [
                {
                    name: "command",
                    description: "The SSH/remote command to run",
                    required: true,
                },
            ],
        },
        {
            name: "pwd",
            description: "Show the current working directory in the active session",
        },
        {
            name: "reconnect",
            description: "Manually trigger a reconnection attempt for the active session",
        },
        // === FILE TRANSFER ===
        {
            name: "upload-file",
            description: "Upload a file to the remote server",
            arguments: [
                {
                    name: "localPath",
                    description: "Path to local file",
                    required: true,
                },
                {
                    name: "remotePath",
                    description: "Destination path on remote",
                    required: true,
                },
            ],
        },
        {
            name: "download-file",
            description: "Download a file from the remote server",
            arguments: [
                {
                    name: "remotePath",
                    description: "Path to remote file",
                    required: true,
                },
                {
                    name: "localPath",
                    description: "Destination path on local",
                    required: true,
                },
            ],
        },
        {
            name: "list-files",
            description: "List files in a remote directory",
            arguments: [
                {
                    name: "path",
                    description: "Remote directory path",
                    required: true,
                },
            ],
        },
        // === PORT FORWARDING ===
        {
            name: "port-forward",
            description: "Set up a local port forward to access remote services locally",
            arguments: [
                {
                    name: "localPort",
                    description: "Local port to listen on",
                    required: true,
                },
                {
                    name: "remotePort",
                    description: "Remote port to forward to",
                    required: true,
                },
                {
                    name: "remoteHost",
                    description: "Remote host (default: localhost)",
                    required: false,
                },
            ],
        },
        {
            name: "list-ports",
            description: "List all active port forwards",
        },
        {
            name: "stop-port",
            description: "Stop a port forward",
            arguments: [
                {
                    name: "forwardId",
                    description: "Forward ID to stop (e.g., fwd-1)",
                    required: true,
                },
            ],
        },
        {
            name: "stop-all-ports",
            description: "Stop all port forwards",
        },
        // === SEARCH & DEBUG ===
        {
            name: "find-errors",
            description: "Search session history for error messages",
        },
        {
            name: "search-output",
            description: "Search through command history and output",
            arguments: [
                {
                    name: "query",
                    description: "Search query",
                    required: true,
                },
            ],
        },
    ];
}
/**
 * Resolve prompt alias to canonical name
 */
function resolveAlias(name) {
    return PROMPT_ALIASES[name] || name;
}
/**
 * Handle prompt requests
 */
export async function handlePrompt(name, args) {
    // Resolve aliases
    const canonicalName = resolveAlias(name);
    switch (canonicalName) {
        // === END SESSION ===
        case "end-session": {
            const sessionId = args?.sessionId || sessionManager.getActiveSessionId() || "";
            const session = sessionId === "all" ? null : sessionManager.getSession(sessionId);
            if (sessionId === "all") {
                const count = sessionManager.getAllSessions().length;
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `End all ${count} remote shell session(s). Use the remote_session_end tool with sessionId="all" to confirm.`,
                            },
                        },
                    ],
                };
            }
            if (!session && !sessionManager.getActiveSessionId()) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote session to end.",
                            },
                        },
                    ],
                };
            }
            const targetSession = session || sessionManager.getActiveSession();
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `End the remote session "${targetSession?.name}" (${targetSession?.id}).

Use the shell tool with command="//end" or the remote_session_end tool to confirm.`,
                        },
                    },
                ],
            };
        }
        // === STOP/INTERRUPT ===
        case "stop": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote session. Nothing to interrupt.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Send Ctrl+C (SIGINT) to interrupt the current command in session "${activeSession.name}".

Use the shell tool with command="//stop" or the remote_session_signal tool with signal="SIGINT" to confirm.`,
                        },
                    },
                ],
            };
        }
        // === SESSION STATUS ===
        case "session-status": {
            const sessionList = sessionManager.getAllSessions();
            if (sessionList.length === 0) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote sessions. Start a session by running an SSH command through the shell tool.",
                            },
                        },
                    ],
                };
            }
            const activeId = sessionManager.getActiveSessionId();
            const statusLines = sessionList.map((s) => {
                const active = activeId === s.id ? " [ACTIVE]" : "";
                const status = s.connected ? "Connected" : "Disconnected";
                const pwd = directoryTracker.getCurrentDirectory(s.id);
                const ports = s.portForwards.length > 0 ? ` | Ports: ${s.portForwards.length}` : "";
                return `- ${s.name} (${s.id})${active}\n  Status: ${status} | Dir: ${pwd} | Commands: ${s.commandHistory.length}${ports}\n  Original: ${s.originalCommand}`;
            });
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Remote Sessions (${sessionList.length}):\n\n${statusLines.join("\n\n")}`,
                        },
                    },
                ],
            };
        }
        // === SWITCH SESSION ===
        case "switch-session": {
            const sessionId = args?.sessionId;
            if (!sessionId) {
                const sessionList = sessionManager.getAllSessions();
                const options = sessionList.map((s) => `- ${s.id}: ${s.name}`).join("\n");
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Please specify a session ID to switch to.\n\nAvailable sessions:\n${options || "No sessions available"}`,
                            },
                        },
                    ],
                };
            }
            const session = sessionManager.getSession(sessionId);
            if (!session) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Session not found: ${sessionId}`,
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Switch to session "${session.name}" (${session.id}). Use the remote_session_switch tool to confirm.`,
                        },
                    },
                ],
            };
        }
        // === SESSION HISTORY ===
        case "session-history": {
            const sessionId = args?.sessionId;
            const limit = args?.limit ? parseInt(args.limit, 10) : 20;
            const session = sessionId
                ? sessionManager.getSession(sessionId)
                : sessionManager.getActiveSession();
            if (!session) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No session found. Start a remote session first.",
                            },
                        },
                    ],
                };
            }
            const history = session.commandHistory.slice(-limit);
            const historyText = history
                .map((h, i) => `${i + 1}. ${h.command} (${h.timestamp.toLocaleTimeString()})`)
                .join("\n");
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Command history for ${session.name} (${history.length} commands):\n\n${historyText || "No commands yet."}`,
                        },
                    },
                ],
            };
        }
        // === EXIT NESTED ===
        case "exit-nested": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote session. Nothing to exit from.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Exit the innermost nested shell in session "${activeSession.name}".

This is for stepping back from nested shells like:
- Inner SSH sessions
- sudo/su shells
- docker exec / kubectl exec sessions

Use the shell tool with command="exit" to send the exit command.`,
                        },
                    },
                ],
            };
        }
        // === NEW SESSION ===
        case "new-session": {
            const command = args?.command;
            if (!command) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide the SSH/remote command to start a new session with.",
                            },
                        },
                    ],
                };
            }
            const currentSession = sessionManager.getActiveSession();
            const currentInfo = currentSession
                ? `Current active session: "${currentSession.name}" - this will remain available.`
                : "No current active session.";
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Start a NEW parallel remote session with command: ${command}

${currentInfo}

Use the shell tool with command="${command}" and forceNewSession=true.`,
                        },
                    },
                ],
            };
        }
        // === PWD ===
        case "pwd": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote session.",
                            },
                        },
                    ],
                };
            }
            const pwd = directoryTracker.getCurrentDirectory(activeSession.id);
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Current working directory in session "${activeSession.name}": ${pwd}

To get the actual current directory from the server, use the shell tool with command="pwd".`,
                        },
                    },
                ],
            };
        }
        // === RECONNECT ===
        case "reconnect": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active remote session to reconnect.",
                            },
                        },
                    ],
                };
            }
            if (activeSession.connected) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Session "${activeSession.name}" is already connected.`,
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Session "${activeSession.name}" is disconnected. Auto-reconnect is ${activeSession.autoReconnect ? "enabled" : "disabled"}.

To manually reconnect, end this session and start a new one with the same command:
1. Use remote_session_end to end this session
2. Use shell tool with command="${activeSession.originalCommand}"`,
                        },
                    },
                ],
            };
        }
        // === UPLOAD FILE ===
        case "upload-file": {
            const localPath = args?.localPath;
            const remotePath = args?.remotePath;
            if (!localPath || !remotePath) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide both localPath and remotePath for file upload.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Upload file from ${localPath} to ${remotePath}.

Use the remote_file_upload tool with localPath="${localPath}" and remotePath="${remotePath}".`,
                        },
                    },
                ],
            };
        }
        // === DOWNLOAD FILE ===
        case "download-file": {
            const remotePath = args?.remotePath;
            const localPath = args?.localPath;
            if (!remotePath || !localPath) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide both remotePath and localPath for file download.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Download file from ${remotePath} to ${localPath}.

Use the remote_file_download tool with remotePath="${remotePath}" and localPath="${localPath}".`,
                        },
                    },
                ],
            };
        }
        // === LIST FILES ===
        case "list-files": {
            const path = args?.path;
            if (!path) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide the remote directory path to list.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `List files in remote directory: ${path}

Use the remote_file_list tool with path="${path}".`,
                        },
                    },
                ],
            };
        }
        // === PORT FORWARD ===
        case "port-forward": {
            const localPort = args?.localPort;
            const remotePort = args?.remotePort;
            const remoteHost = args?.remoteHost || "localhost";
            if (!localPort || !remotePort) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide localPort and remotePort for port forwarding.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Set up local port forward: localhost:${localPort} → ${remoteHost}:${remotePort}

Use the remote_port_forward_local tool with localPort=${localPort}, remoteHost="${remoteHost}", remotePort=${remotePort}.`,
                        },
                    },
                ],
            };
        }
        // === LIST PORTS ===
        case "list-ports": {
            const activeSession = sessionManager.getActiveSession();
            // Collect all forwards from all sessions
            const allForwards = [];
            for (const session of sessionManager.getAllSessions()) {
                for (const forward of session.portForwards) {
                    const desc = forward.type === "local"
                        ? `localhost:${forward.localPort} → ${forward.remoteHost}:${forward.remotePort}`
                        : `*:${forward.remotePort} → localhost:${forward.localPort}`;
                    allForwards.push({
                        session: session.name,
                        id: forward.id,
                        description: desc,
                    });
                }
            }
            if (allForwards.length === 0) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active port forwards.",
                            },
                        },
                    ],
                };
            }
            const lines = allForwards.map(f => `- ${f.id}: ${f.description} (${f.session})`);
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Active Port Forwards (${allForwards.length}):\n\n${lines.join("\n")}

Use remote_port_stop with forwardId to stop a specific forward.`,
                        },
                    },
                ],
            };
        }
        // === STOP PORT ===
        case "stop-port": {
            const forwardId = args?.forwardId;
            if (!forwardId) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide the forwardId to stop. Use the list-ports prompt to see active forwards.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Stop port forward: ${forwardId}

Use the remote_port_stop tool with forwardId="${forwardId}".`,
                        },
                    },
                ],
            };
        }
        // === STOP ALL PORTS ===
        case "stop-all-ports": {
            const totalForwards = sessionManager.getAllSessions()
                .reduce((sum, s) => sum + s.portForwards.length, 0);
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Stop all ${totalForwards} port forward(s).

Use the remote_port_stop_all tool to confirm.`,
                        },
                    },
                ],
            };
        }
        // === FIND ERRORS ===
        case "find-errors": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active session. Start a remote session first.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Search for errors in session "${activeSession.name}".

Use the remote_session_errors tool to find error messages in command history.`,
                        },
                    },
                ],
            };
        }
        // === SEARCH OUTPUT ===
        case "search-output": {
            const query = args?.query;
            if (!query) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide a search query.",
                            },
                        },
                    ],
                };
            }
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Search command history for: "${query}"

Use the remote_session_search tool with query="${query}".`,
                        },
                    },
                ],
            };
        }
        default:
            throw new Error(`Unknown prompt: ${name}`);
    }
}
//# sourceMappingURL=index.js.map