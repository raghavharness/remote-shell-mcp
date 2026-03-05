import { sessionManager } from "../session-manager.js";
import { isSessionExitCommand, isSessionInterruptCommand, isRemoteShellCommand, extractSessionName } from "../utils/patterns.js";
import { COLORS, formatOutputStart, formatOutputEnd } from "../utils/ansi.js";
import { smartWait } from "../features/smart-wait.js";
import { directoryTracker } from "../features/directory-tracker.js";
import { formatSessionHeader, formatErrorBlock, formatUptime, ICONS, } from "../utils/terminal-ui.js";
import { analyzeError, errorHandler } from "../features/error-handler.js";
/**
 * Handle the main shell tool
 */
export async function handleShellTool(params) {
    const { command, waitTime, forceNewSession, stream } = params;
    const trimmedCommand = command.trim();
    // Check for exit/end session commands
    if (isSessionExitCommand(trimmedCommand)) {
        return handleExitCommand();
    }
    // Check for interrupt commands (Ctrl+C)
    if (isSessionInterruptCommand(trimmedCommand)) {
        return handleInterruptCommand();
    }
    // Check if we have an active session
    const session = sessionManager.getActiveSession();
    const shouldForceNew = forceNewSession && isRemoteShellCommand(trimmedCommand);
    if (session && !shouldForceNew) {
        return executeInSession(session, trimmedCommand, waitTime);
    }
    // No active session - check if this is a remote shell command
    if (isRemoteShellCommand(trimmedCommand)) {
        return startNewSession(trimmedCommand, waitTime);
    }
    // No session and not a remote command
    return {
        content: [
            {
                type: "text",
                text: `**No active remote session**

The command \`${command}\` was not recognized as a remote shell command (ssh, gcloud ssh, etc.).

To start a remote session, use commands like:
- \`ssh user@hostname\`
- \`gcloud compute ssh instance-name --zone us-central1-a\`
- \`aws ssm start-session --target i-xxxxxx\`

Or use the Bash tool to run this command locally.`,
            },
        ],
    };
}
/**
 * Handle exit commands
 */
async function handleExitCommand() {
    const session = sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active remote session.${COLORS.reset} You are in the local shell.`,
                },
            ],
        };
    }
    const sessionName = session.name;
    await sessionManager.endSession(session.id);
    const activeSession = sessionManager.getActiveSession();
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.bold}${COLORS.green}Session ended: ${sessionName}${COLORS.reset}

${activeSession ? `${COLORS.cyan}Switched to: ${activeSession.name}${COLORS.reset}` : `${COLORS.gray}You are now back in the local shell.${COLORS.reset}`}`,
            },
        ],
    };
}
/**
 * Handle interrupt commands
 */
async function handleInterruptCommand() {
    const session = sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.yellow}No active remote session to interrupt.${COLORS.reset}`,
                },
            ],
        };
    }
    const recentOutput = await sessionManager.sendInterrupt(session);
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.yellow}^C${COLORS.reset} ${COLORS.gray}(sent SIGINT to ${session.name})${COLORS.reset}

${recentOutput ? `${formatOutputStart()}\n${recentOutput}\n${formatOutputEnd()}` : ""}`,
            },
        ],
    };
}
/**
 * Execute a command in an existing session
 */
async function executeInSession(session, command, waitTime) {
    // For child process sessions, check if the process is actually still running
    // Don't just rely on session.connected flag which may not be set correctly
    // during initial connection
    if (session.type === "child_process" && session.childProcess) {
        const processStillRunning = session.childProcess.exitCode === null && !session.childProcess.killed;
        if (processStillRunning) {
            // Process is running, update connected flag
            session.connected = true;
        }
        else {
            session.connected = false;
        }
    }
    if (!session.connected) {
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.red}${ICONS.error}${COLORS.reset} **Session disconnected: ${session.name}**

The remote session has been disconnected. ${session.autoReconnect ? "Attempting to reconnect..." : "Start a new session to continue."}`,
                },
            ],
        };
    }
    // Get smart wait time
    const actualWaitTime = waitTime ?? smartWait.getWaitTime(command);
    const waitReason = smartWait.getWaitTimeReason(command);
    let output;
    if (session.type === "ssh2") {
        output = await sessionManager.execSsh2Command(session, command, actualWaitTime);
    }
    else {
        output = await sessionManager.execChildProcessCommand(session, command, actualWaitTime);
    }
    // Get current working directory
    const pwd = directoryTracker.getCurrentDirectory(session.id);
    const uptime = formatUptime(session.startedAt);
    // Build the beautiful terminal UI
    const header = formatSessionHeader(session.name, pwd, session.connected, command, uptime);
    // Check for errors in output (check exit code via echo $?)
    // For child process sessions, we need to analyze the output for error patterns
    const errorAnalysis = errorHandler.analyzeWithSession(session.id, command, output, undefined // Exit code not directly available for child process sessions
    );
    // Add wait time info if it was smart-adjusted
    const waitInfo = waitReason && actualWaitTime > 2000
        ? `\n${COLORS.dim}${COLORS.gray}(waited ${actualWaitTime / 1000}s for: ${waitReason})${COLORS.reset}`
        : "";
    // Build output with error handling if needed
    let resultText;
    if (errorAnalysis.isError && errorAnalysis.context.errorType) {
        // Show error with context for AI to analyze
        resultText = `${header}
${output}
${formatErrorBlock(command, errorAnalysis.exitCode, errorAnalysis.stderr || "", errorAnalysis.context)}${waitInfo}`;
    }
    else {
        // Normal output
        resultText = `${header}
${output}${waitInfo}`;
    }
    return {
        content: [
            {
                type: "text",
                text: resultText,
            },
        ],
        isError: errorAnalysis.isError,
    };
}
/**
 * Start a new remote session
 */
async function startNewSession(command, waitTime) {
    const sessionName = extractSessionName(command);
    const parts = command.split(/\s+/);
    const executable = parts[0];
    const cmdArgs = parts.slice(1);
    const session = await sessionManager.startChildProcessSession(executable, cmdArgs, sessionName, `Remote session: ${command}`, command);
    const initialOutput = session.outputBuffer.join("").slice(-2000);
    const pwd = directoryTracker.getCurrentDirectory(session.id);
    // Check if connection actually succeeded
    if (!session.connected) {
        // Connection failed - clean up and show error
        const errorAnalysis = analyzeError(command, initialOutput, 1);
        await sessionManager.endSession(session.id);
        return {
            content: [
                {
                    type: "text",
                    text: `${COLORS.gray}╭${"─".repeat(58)}╮${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.red}${COLORS.bold}${ICONS.error} Connection Failed${COLORS.reset}${" ".repeat(40)}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}├${"─".repeat(58)}┤${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.cyan}Session:${COLORS.reset} ${session.name}${" ".repeat(Math.max(0, 48 - session.name.length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}╰${"─".repeat(58)}╯${COLORS.reset}

${initialOutput || `${COLORS.yellow}(no output captured)${COLORS.reset}`}

${errorAnalysis.isError && errorAnalysis.context.suggestedFix ? `${COLORS.yellow}${ICONS.suggestion} Suggested fix:${COLORS.reset} ${COLORS.cyan}${errorAnalysis.context.suggestedFix}${COLORS.reset}\n` : ""}${COLORS.gray}The remote session failed to establish. Please check the error above and try again.${COLORS.reset}`,
                },
            ],
            isError: true,
        };
    }
    // Success - show beautiful connected status
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.gray}╭${"─".repeat(58)}╮${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.green}${COLORS.bold}${ICONS.success} Remote Session Started${COLORS.reset}${" ".repeat(34)}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}├${"─".repeat(58)}┤${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${ICONS.folder} ${COLORS.blue}${pwd}${COLORS.reset} ${COLORS.gray}│${COLORS.reset} ${COLORS.green}${ICONS.connected}${COLORS.reset} Connected ${COLORS.gray}│${COLORS.reset} ${ICONS.clock} 0s${" ".repeat(20)}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}├${"─".repeat(58)}┤${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.cyan}Session:${COLORS.reset} ${session.name}${" ".repeat(Math.max(0, 48 - session.name.length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.cyan}ID:${COLORS.reset} ${session.id}${" ".repeat(Math.max(0, 53 - session.id.length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.cyan}Auto-reconnect:${COLORS.reset} ${session.autoReconnect ? `${COLORS.green}enabled${COLORS.reset}` : `${COLORS.red}disabled${COLORS.reset}`}${" ".repeat(35)}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}╰${"─".repeat(58)}╯${COLORS.reset}

${initialOutput || `${COLORS.dim}(connecting...)${COLORS.reset}`}

${COLORS.gray}You are now in a remote shell. Commands will execute remotely.${COLORS.reset}
${COLORS.yellow}To exit: type ${COLORS.bold}~.${COLORS.reset}${COLORS.yellow} or ${COLORS.bold}//end${COLORS.reset}`,
            },
        ],
    };
}
/**
 * Get tool definition for shell
 */
export function getShellToolDefinition() {
    return {
        name: "shell",
        description: `**PRIMARY TOOL** - Intelligent shell command handler for remote sessions.

This tool automatically detects and handles:
1. **Remote shell commands** (ssh, gcloud compute ssh, aws ssm, az ssh, etc.) - Starts a persistent session
2. **Regular commands when session is active** - Executes in the remote session
3. **Session control** - Use special exit sequences to close the session

**Smart Wait Time**: Automatically adjusts wait time based on command type (longer for builds, shorter for ls).

**Working Directory Tracking**: Tracks cd commands and shows current directory in prompt.

**Control sequences** (to avoid conflict with normal commands):
- \`~.\` or \`//end\` - End session and return to local shell
- \`//stop\` or \`//kill\` or \`//ctrl-c\` - Send Ctrl+C (SIGINT) to interrupt running command

**Auto-reconnect**: Sessions automatically attempt to reconnect on disconnection.

Sessions auto-cleanup after 1 hour of inactivity. Output is displayed exactly as the terminal shows.`,
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The shell command to execute",
                },
                waitTime: {
                    type: "number",
                    description: "Override smart wait time (ms). If not provided, automatically determined based on command type.",
                },
                forceNewSession: {
                    type: "boolean",
                    description: "Force creation of a new parallel session even if one is active",
                },
                stream: {
                    type: "boolean",
                    description: "Enable streaming output for long-running commands",
                },
            },
            required: ["command"],
        },
    };
}
//# sourceMappingURL=shell.js.map