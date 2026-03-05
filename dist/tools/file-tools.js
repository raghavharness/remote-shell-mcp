import { sessionManager } from "../session-manager.js";
import { fileTransfer } from "../features/file-transfer.js";
import { COLORS, formatSuccess, formatError, formatInfo } from "../utils/ansi.js";
/**
 * Handle file upload tool
 */
export async function handleFileUpload(params) {
    const { localPath, remotePath, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No active session. Connect to a remote server first.") }],
            isError: true,
        };
    }
    const result = await fileTransfer.upload(session, { localPath, remotePath });
    return formatTransferResult(result, "upload");
}
/**
 * Handle file download tool
 */
export async function handleFileDownload(params) {
    const { remotePath, localPath, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No active session. Connect to a remote server first.") }],
            isError: true,
        };
    }
    const result = await fileTransfer.download(session, { localPath, remotePath });
    return formatTransferResult(result, "download");
}
/**
 * Handle list remote directory tool
 */
export async function handleListRemote(params) {
    const { path, sessionId } = params;
    const session = sessionId
        ? sessionManager.getSession(sessionId)
        : sessionManager.getActiveSession();
    if (!session) {
        return {
            content: [{ type: "text", text: formatError("No active session. Connect to a remote server first.") }],
            isError: true,
        };
    }
    const files = await fileTransfer.listRemote(session, path);
    if (files.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `${formatInfo(`Directory listing for ${path}`)}\n\n(empty or not found)`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${COLORS.bold}Directory: ${path}${COLORS.reset}

${files.join("\n")}`,
            },
        ],
    };
}
/**
 * Format transfer result
 */
function formatTransferResult(result, operation) {
    const direction = operation === "upload" ? "→" : "←";
    const durationSec = (result.duration / 1000).toFixed(2);
    const sizeMB = (result.bytesTransferred / (1024 * 1024)).toFixed(2);
    const sizeKB = (result.bytesTransferred / 1024).toFixed(2);
    const sizeDisplay = result.bytesTransferred > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
    if (result.success) {
        return {
            content: [
                {
                    type: "text",
                    text: `${formatSuccess(`File ${operation} complete`)}

${COLORS.cyan}Local:${COLORS.reset}  ${result.localPath}
${COLORS.cyan}Remote:${COLORS.reset} ${result.remotePath}
${COLORS.cyan}Size:${COLORS.reset}   ${sizeDisplay} (${result.bytesTransferred} bytes)
${COLORS.cyan}Time:${COLORS.reset}   ${durationSec}s

${result.localPath} ${direction} ${result.remotePath}`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${formatError(`File ${operation} failed`)}

${COLORS.cyan}Local:${COLORS.reset}  ${result.localPath}
${COLORS.cyan}Remote:${COLORS.reset} ${result.remotePath}
${COLORS.red}Error:${COLORS.reset}  ${result.error}`,
            },
        ],
        isError: true,
    };
}
/**
 * Get file tool definitions
 */
export function getFileToolDefinitions() {
    return [
        {
            name: "remote_file_upload",
            description: `Upload a file from local machine to the remote server.

Works with both SSH2 and child process sessions:
- SSH2: Uses SFTP for efficient binary transfer
- Child process: Uses base64 encoding through the shell

Example: Upload a config file to the server.`,
            inputSchema: {
                type: "object",
                properties: {
                    localPath: {
                        type: "string",
                        description: "Path to local file (supports ~ expansion)",
                    },
                    remotePath: {
                        type: "string",
                        description: "Destination path on remote server",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional, defaults to active session)",
                    },
                },
                required: ["localPath", "remotePath"],
            },
        },
        {
            name: "remote_file_download",
            description: `Download a file from the remote server to local machine.

Works with both SSH2 and child process sessions:
- SSH2: Uses SFTP for efficient binary transfer
- Child process: Uses base64 encoding through the shell

Example: Download logs or config files from a server.`,
            inputSchema: {
                type: "object",
                properties: {
                    remotePath: {
                        type: "string",
                        description: "Path to file on remote server",
                    },
                    localPath: {
                        type: "string",
                        description: "Destination path on local machine (supports ~ expansion)",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional, defaults to active session)",
                    },
                },
                required: ["remotePath", "localPath"],
            },
        },
        {
            name: "remote_file_list",
            description: "List files in a remote directory with details (like ls -la).",
            inputSchema: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Remote directory path to list",
                    },
                    sessionId: {
                        type: "string",
                        description: "Session ID (optional, defaults to active session)",
                    },
                },
                required: ["path"],
            },
        },
    ];
}
//# sourceMappingURL=file-tools.js.map