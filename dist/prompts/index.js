import { sessionManager } from "../session-manager.js";
import { directoryTracker } from "../features/directory-tracker.js";
import { blockManager } from "../features/blocks.js";
import { paneManager } from "../features/panes.js";
import { shareManager } from "../features/sharing/share-manager.js";
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
        // === BLOCKS (Warp-style) ===
        {
            name: "blocks",
            description: "List recent command blocks for the active session",
            arguments: [
                {
                    name: "limit",
                    description: "Number of blocks to show (default: 10)",
                    required: false,
                },
            ],
        },
        {
            name: "block",
            description: "Get a specific block by ID",
            arguments: [
                {
                    name: "blockId",
                    description: "Block ID (e.g., block-1)",
                    required: true,
                },
            ],
        },
        {
            name: "block-search",
            description: "Search through command blocks",
            arguments: [
                {
                    name: "query",
                    description: "Search query",
                    required: true,
                },
            ],
        },
        {
            name: "block-errors",
            description: "Find error blocks in session history",
        },
        {
            name: "block-tag",
            description: "Tag a block for organization",
            arguments: [
                {
                    name: "blockId",
                    description: "Block ID",
                    required: true,
                },
                {
                    name: "tags",
                    description: "Comma-separated tags to add",
                    required: true,
                },
            ],
        },
        // === PANES (tmux-style) ===
        {
            name: "split",
            description: "Split the current pane horizontally or vertically",
            arguments: [
                {
                    name: "direction",
                    description: "Split direction: horizontal or vertical",
                    required: true,
                },
            ],
        },
        {
            name: "panes",
            description: "List all panes in the current session",
        },
        {
            name: "pane-focus",
            description: "Switch to a specific pane",
            arguments: [
                {
                    name: "paneId",
                    description: "Pane ID to focus",
                    required: true,
                },
            ],
        },
        {
            name: "pane-close",
            description: "Close a pane",
            arguments: [
                {
                    name: "paneId",
                    description: "Pane ID to close",
                    required: true,
                },
            ],
        },
        {
            name: "broadcast",
            description: "Broadcast a command to all panes",
            arguments: [
                {
                    name: "command",
                    description: "Command to broadcast",
                    required: true,
                },
            ],
        },
        // === SHARING ===
        {
            name: "share",
            description: "Share the current session for collaboration",
            arguments: [
                {
                    name: "permissions",
                    description: "Permission level: view or control",
                    required: false,
                },
                {
                    name: "password",
                    description: "Optional password protection",
                    required: false,
                },
            ],
        },
        {
            name: "unshare",
            description: "Stop sharing the current session",
        },
        {
            name: "shares",
            description: "List all active session shares",
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
        // === BLOCKS ===
        case "blocks": {
            const limit = args?.limit ? parseInt(args.limit, 10) : 10;
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
            const blockCount = blockManager.getBlockCount(activeSession.id);
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `List recent command blocks for session "${activeSession.name}" (${blockCount} total blocks).

Use the remote_blocks_list tool with limit=${limit}.`,
                        },
                    },
                ],
            };
        }
        case "block": {
            const blockId = args?.blockId;
            if (!blockId) {
                // List recent blocks to help user choose
                const activeSession = sessionManager.getActiveSession();
                const recentBlocks = activeSession
                    ? blockManager.getSessionBlocks(activeSession.id, 5)
                    : blockManager.getRecentBlocks(5);
                const blockList = recentBlocks.map(b => `- ${b.id}: ${b.command.substring(0, 50)}`).join("\n");
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Please specify a block ID.

Recent blocks:
${blockList || "No blocks yet."}`,
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
                            text: `Get block: ${blockId}

Use the remote_block_get tool with blockId="${blockId}".`,
                        },
                    },
                ],
            };
        }
        case "block-search": {
            const query = args?.query;
            if (!query) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide a search query for block search.",
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
                            text: `Search blocks for: "${query}"

Use the remote_blocks_search tool with query="${query}".`,
                        },
                    },
                ],
            };
        }
        case "block-errors": {
            const activeSession = sessionManager.getActiveSession();
            const errorBlocks = activeSession
                ? blockManager.findErrorBlocks(activeSession.id)
                : blockManager.findErrorBlocks();
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Find error blocks${activeSession ? ` in session "${activeSession.name}"` : ""} (${errorBlocks.length} errors found).

Use the remote_blocks_errors tool.`,
                        },
                    },
                ],
            };
        }
        case "block-tag": {
            const blockId = args?.blockId;
            const tagsStr = args?.tags;
            if (!blockId || !tagsStr) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide both blockId and tags (comma-separated).",
                            },
                        },
                    ],
                };
            }
            const tags = tagsStr.split(",").map(t => t.trim());
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Tag block ${blockId} with: ${tags.join(", ")}

Use the remote_block_tag tool with blockId="${blockId}" and tags=${JSON.stringify(tags)}.`,
                        },
                    },
                ],
            };
        }
        // === PANES ===
        case "split": {
            const direction = args?.direction;
            if (!direction || !["horizontal", "vertical"].includes(direction)) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please specify direction: horizontal or vertical",
                            },
                        },
                    ],
                };
            }
            const activeSession = sessionManager.getActiveSession();
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Split pane ${direction}ly${activeSession ? ` in session "${activeSession.name}"` : ""}.

Use the remote_pane_split tool with direction="${direction}".`,
                        },
                    },
                ],
            };
        }
        case "panes": {
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
            const paneCount = paneManager.getPaneCount(activeSession.id);
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `List panes for session "${activeSession.name}" (${paneCount} pane(s)).

Use the remote_pane_list tool.`,
                        },
                    },
                ],
            };
        }
        case "pane-focus": {
            const paneId = args?.paneId;
            if (!paneId) {
                const activeSession = sessionManager.getActiveSession();
                const panes = activeSession
                    ? paneManager.getSessionPanes(activeSession.id)
                    : [];
                const paneList = panes.map(p => `- ${p.id}${p.active ? " [active]" : ""}`).join("\n");
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Please specify a pane ID.

Available panes:
${paneList || "No panes available."}`,
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
                            text: `Focus pane: ${paneId}

Use the remote_pane_focus tool with paneId="${paneId}".`,
                        },
                    },
                ],
            };
        }
        case "pane-close": {
            const paneId = args?.paneId;
            if (!paneId) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please specify a pane ID to close.",
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
                            text: `Close pane: ${paneId}

Use the remote_pane_close tool with paneId="${paneId}".`,
                        },
                    },
                ],
            };
        }
        case "broadcast": {
            const command = args?.command;
            if (!command) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "Please provide a command to broadcast.",
                            },
                        },
                    ],
                };
            }
            const activeSession = sessionManager.getActiveSession();
            const paneCount = activeSession
                ? paneManager.getPaneCount(activeSession.id)
                : 0;
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Broadcast command to ${paneCount} pane(s): ${command}

Use the remote_pane_broadcast tool with command="${command}".`,
                        },
                    },
                ],
            };
        }
        // === SHARING ===
        case "share": {
            const permissions = args?.permissions || "view";
            const password = args?.password;
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active session to share. Start a remote session first.",
                            },
                        },
                    ],
                };
            }
            const existingShare = shareManager.getShareForSession(activeSession.id);
            if (existingShare) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Session "${activeSession.name}" is already shared.

Share ID: ${existingShare.shareId}
Permissions: ${existingShare.permissions}
Clients: ${existingShare.connectedClients}

Use remote_session_unshare to stop sharing, or remote_share_update to modify.`,
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
                            text: `Share session "${activeSession.name}" with ${permissions} permissions${password ? " (password protected)" : ""}.

Use the remote_session_share tool with permissions="${permissions}"${password ? `, password="${password}"` : ""}.`,
                        },
                    },
                ],
            };
        }
        case "unshare": {
            const activeSession = sessionManager.getActiveSession();
            if (!activeSession) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active session.",
                            },
                        },
                    ],
                };
            }
            const share = shareManager.getShareForSession(activeSession.id);
            if (!share) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Session "${activeSession.name}" is not currently shared.`,
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
                            text: `Stop sharing session "${activeSession.name}" (${share.connectedClients} connected client(s)).

Use the remote_session_unshare tool.`,
                        },
                    },
                ],
            };
        }
        case "shares": {
            const allShares = shareManager.getAllShares();
            if (allShares.length === 0) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: "No active shares. Use the share prompt to start sharing a session.",
                            },
                        },
                    ],
                };
            }
            const shareList = allShares.map(s => {
                const session = sessionManager.getSession(s.sessionId);
                return `- ${s.shareId}: ${session?.name || s.sessionId} (${s.permissions}, ${s.connectedClients} clients)`;
            }).join("\n");
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Active shares (${allShares.length}):

${shareList}

Use remote_shares_list for more details.`,
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