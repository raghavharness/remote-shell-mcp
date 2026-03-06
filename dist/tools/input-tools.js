import { sessionManager } from "../session-manager.js";
import { realtimeStream } from "../features/realtime-stream.js";
import { COLORS } from "../utils/ansi.js";
import { ICONS } from "../utils/terminal-ui.js";
import { collectOutput } from "../features/streaming.js";
// ============================================================================
// Input Tool Handlers
// ============================================================================
/**
 * Send input to a session (respond to prompts)
 */
export async function handleSessionInput(params) {
    const { input, sessionId, hideInput, waitForOutput = true, waitTime = 2000 } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}${ICONS.error}${COLORS.reset} No session found. Start a remote session first.`,
                },
            ],
            isError: true,
        };
    }
    if (!session.connected) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}${ICONS.error}${COLORS.reset} Session "${session.name}" is disconnected.`,
                },
            ],
            isError: true,
        };
    }
    // Check for child process
    if (session.type !== "child_process" || !session.childProcess?.stdin) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}${ICONS.warning}${COLORS.reset} Input not supported for this session type.`,
                },
            ],
            isError: true,
        };
    }
    // Clear pending prompt since we're responding
    realtimeStream.clearPendingPrompt(session.id);
    // Clear output buffer before sending
    session.outputBuffer = [];
    // Send the input
    const inputWithNewline = input.endsWith("\n") ? input : input + "\n";
    session.childProcess.stdin.write(inputWithNewline);
    session.lastActivity = new Date();
    // Display masked input for passwords
    const displayInput = hideInput ? "********" : input;
    if (!waitForOutput) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.green}${ICONS.success}${COLORS.reset} Sent input to ${session.name}${hideInput ? " (hidden)" : ""}`,
                },
            ],
        };
    }
    // Wait for output response
    const output = await collectOutput(session, waitTime);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.cyan}${session.name}${COLORS.reset} ${COLORS.gray}←${COLORS.reset} ${displayInput}

${output || `${COLORS.dim}(no output within ${waitTime}ms)${COLORS.reset}`}`,
            },
        ],
    };
}
/**
 * Check if a session is waiting for input
 */
export async function handleCheckPrompt(params) {
    const { sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active session.${COLORS.reset}`,
                },
            ],
        };
    }
    const pendingPrompt = realtimeStream.getPendingPrompt(session.id);
    if (!pendingPrompt) {
        // Also check the output buffer for common prompt patterns
        const recentOutput = session.outputBuffer.slice(-10).join("");
        const promptPatterns = [
            { pattern: /password[:\s]*$/i, type: "password" },
            { pattern: /\[y\/n\][:\s]*$/i, type: "confirmation" },
            { pattern: /\(yes\/no\)[:\s]*$/i, type: "confirmation" },
            { pattern: /continue\?[:\s]*$/i, type: "confirmation" },
            { pattern: /enter.*:/i, type: "text" },
        ];
        for (const { pattern, type } of promptPatterns) {
            if (pattern.test(recentOutput)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `${COLORS.yellow}${ICONS.warning}${COLORS.reset} **Prompt detected** in ${session.name}

${COLORS.cyan}Type:${COLORS.reset} ${type}
${COLORS.cyan}Recent output:${COLORS.reset}
\`\`\`
${recentOutput.slice(-200)}
\`\`\`

Use ${COLORS.bold}remote_session_input${COLORS.reset} to respond.${type === "password" ? " Set hideInput=true for passwords." : ""}`,
                        },
                    ],
                };
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.green}No pending prompts${COLORS.reset} in session "${session.name}".

Recent output:
\`\`\`
${recentOutput.slice(-300) || "(no recent output)"}
\`\`\``,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.yellow}${ICONS.warning}${COLORS.reset} **Prompt waiting for input** in ${session.name}

${COLORS.cyan}Type:${COLORS.reset} ${pendingPrompt.type}
${COLORS.cyan}Prompt:${COLORS.reset} ${pendingPrompt.prompt}
${COLORS.cyan}Detected:${COLORS.reset} ${pendingPrompt.detectedAt.toLocaleTimeString()}

Use ${COLORS.bold}remote_session_input${COLORS.reset} to respond.${pendingPrompt.type === "password" ? " Set hideInput=true for passwords." : ""}`,
            },
        ],
    };
}
/**
 * Send confirmation (y/yes or n/no)
 */
export async function handleConfirm(params) {
    const { confirm, sessionId, waitTime = 2000 } = params;
    const input = confirm ? "y" : "n";
    return handleSessionInput({
        input,
        sessionId,
        hideInput: false,
        waitForOutput: true,
        waitTime,
    });
}
/**
 * Send password (with hidden display)
 */
export async function handleSendPassword(params) {
    const { password, sessionId, waitTime = 3000 } = params;
    return handleSessionInput({
        input: password,
        sessionId,
        hideInput: true,
        waitForOutput: true,
        waitTime,
    });
}
/**
 * Enable real-time streaming for a session
 */
export async function handleEnableStreaming(params) {
    const { sessionId, autoInterrupt, errorPatterns } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}No session found.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    // Convert string patterns to RegExp
    const regexPatterns = errorPatterns?.map(p => new RegExp(p, "i"));
    realtimeStream.enableStreaming(session, {
        autoInterrupt,
        errorPatterns: regexPatterns,
    });
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Real-time streaming enabled for ${session.name}

${COLORS.cyan}Auto-interrupt on error:${COLORS.reset} ${autoInterrupt ? "enabled" : "disabled"}
${COLORS.cyan}Custom error patterns:${COLORS.reset} ${errorPatterns?.length || 0}

Streaming will detect:
- Error patterns in output
- Interactive prompts (passwords, confirmations)
- Command completion`,
            },
        ],
    };
}
/**
 * Disable streaming for a session
 */
export async function handleDisableStreaming(params) {
    const { sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active session.${COLORS.reset}`,
                },
            ],
        };
    }
    realtimeStream.disableStreaming(session.id);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.success}${COLORS.reset} Streaming disabled for ${session.name}`,
            },
        ],
    };
}
/**
 * Get streaming status
 */
export async function handleStreamingStatus(params) {
    const { sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active session.${COLORS.reset}`,
                },
            ],
        };
    }
    const isEnabled = realtimeStream.isStreamingEnabled(session.id);
    const config = realtimeStream.getConfig(session.id);
    const errorCount = realtimeStream.getErrorCount(session.id);
    const pendingPrompt = realtimeStream.getPendingPrompt(session.id);
    if (!isEnabled) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.gray}Streaming not enabled${COLORS.reset} for ${session.name}.

Use ${COLORS.bold}remote_stream_enable${COLORS.reset} to enable real-time streaming.`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.green}${ICONS.connected}${COLORS.reset} **Streaming active** for ${session.name}

${COLORS.cyan}Auto-interrupt:${COLORS.reset} ${config?.autoInterrupt ? "enabled" : "disabled"}
${COLORS.cyan}Error patterns:${COLORS.reset} ${config?.errorPatterns.length || 0}
${COLORS.cyan}Errors detected:${COLORS.reset} ${errorCount}
${COLORS.cyan}Pending prompt:${COLORS.reset} ${pendingPrompt ? pendingPrompt.type : "none"}`,
            },
        ],
    };
}
// ============================================================================
// Tool Definitions
// ============================================================================
export function getInputToolDefinitions() {
    return [
        {
            name: "remote_session_input",
            description: `Send input text to a session (respond to prompts, passwords, confirmations).

Use when a remote command is waiting for user input:
- Password prompts
- Y/N confirmations
- Interactive text input
- Any prompt ending with : or ?

Set hideInput=true for passwords to avoid logging sensitive data.`,
            inputSchema: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: "Input text to send",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                    hideInput: {
                        type: "boolean",
                        description: "Hide input in response (for passwords). Default: false",
                    },
                    waitForOutput: {
                        type: "boolean",
                        description: "Wait for output after sending. Default: true",
                    },
                    waitTime: {
                        type: "number",
                        description: "How long to wait for output (ms). Default: 2000",
                    },
                },
                required: ["input"],
            },
        },
        {
            name: "remote_session_check_prompt",
            description: `Check if a session is waiting for user input (password, confirmation, etc.).

Returns details about any detected prompt and how to respond.`,
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                },
            },
        },
        {
            name: "remote_session_confirm",
            description: "Send a Y/N confirmation response to a session.",
            inputSchema: {
                type: "object",
                properties: {
                    confirm: {
                        type: "boolean",
                        description: "true for 'y', false for 'n'",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                    waitTime: {
                        type: "number",
                        description: "Wait time for output (ms). Default: 2000",
                    },
                },
                required: ["confirm"],
            },
        },
        {
            name: "remote_session_password",
            description: `Send a password to a session. Input is automatically hidden in responses.

Use when prompted for sudo password, SSH passphrase, or other secret input.`,
            inputSchema: {
                type: "object",
                properties: {
                    password: {
                        type: "string",
                        description: "Password to send",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                    waitTime: {
                        type: "number",
                        description: "Wait time for output (ms). Default: 3000",
                    },
                },
                required: ["password"],
            },
        },
        {
            name: "remote_stream_enable",
            description: `Enable real-time streaming for a session with error detection.

When enabled, the system monitors output in real-time for:
- Error patterns (configurable)
- Interactive prompts requiring input
- Command completion

With autoInterrupt=true, it will automatically send Ctrl+C when errors are detected.`,
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                    autoInterrupt: {
                        type: "boolean",
                        description: "Auto-send Ctrl+C on error detection. Default: false",
                    },
                    errorPatterns: {
                        type: "array",
                        items: { type: "string" },
                        description: "Additional regex patterns to detect errors",
                    },
                },
            },
        },
        {
            name: "remote_stream_disable",
            description: "Disable real-time streaming for a session.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                },
            },
        },
        {
            name: "remote_stream_status",
            description: "Get streaming status for a session (enabled, error count, pending prompts).",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: {
                        type: "string",
                        description: "Session ID (defaults to active session)",
                    },
                },
            },
        },
    ];
}
//# sourceMappingURL=input-tools.js.map