import { shareManager, shareServer } from "../features/sharing/index.js";
import { sessionManager } from "../session-manager.js";
import { COLORS } from "../utils/ansi.js";
import { ICONS } from "../utils/terminal-ui.js";

// ============================================================================
// Share Tool Handlers
// ============================================================================

/**
 * Start sharing a session
 */
export async function handleSessionShare(params: {
  sessionId?: string;
  permissions?: "view" | "control";
  password?: string;
  expiresInMinutes?: number;
}) {
  const { sessionId, permissions = "view", password, expiresInMinutes = 60 } = params;

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

  const session = sessionManager.getSession(targetSessionId);
  if (!session) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Session not found: ${targetSessionId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  // Ensure share server is running
  if (!shareServer.isRunning()) {
    try {
      await shareServer.start();
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `${COLORS.red}Failed to start share server:${COLORS.reset} ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Create share
  const share = shareManager.createShare(targetSessionId, permissions, {
    password,
    expiresInMs: expiresInMinutes * 60 * 1000,
  });

  const shareUrl = shareManager.getShareUrl(share.shareId, `http://localhost:${shareServer.getPort()}`);

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}${ICONS.success}${COLORS.reset} Session sharing enabled

${COLORS.cyan}Share URL:${COLORS.reset} ${shareUrl}
${COLORS.cyan}Share ID:${COLORS.reset} ${share.shareId}
${COLORS.cyan}Session:${COLORS.reset} ${session.name}
${COLORS.cyan}Permissions:${COLORS.reset} ${permissions}
${COLORS.cyan}Password protected:${COLORS.reset} ${password ? "Yes" : "No"}
${COLORS.cyan}Expires:${COLORS.reset} ${share.expiresAt.toLocaleString()}

${COLORS.gray}Share this URL with collaborators. They can view${permissions === "control" ? " and control" : ""} your terminal session.${COLORS.reset}`,
      },
    ],
  };
}

/**
 * Stop sharing a session
 */
export async function handleSessionUnshare(params: { shareId?: string; sessionId?: string }) {
  const { shareId, sessionId } = params;

  let success = false;
  let targetShareId: string | null = null;

  if (shareId) {
    targetShareId = shareId;
  } else {
    const targetSessionId = sessionId || sessionManager.getActiveSessionId();
    if (targetSessionId) {
      const share = shareManager.getShareForSession(targetSessionId);
      if (share) {
        targetShareId = share.shareId;
      }
    }
  }

  if (targetShareId) {
    // Broadcast session-ended to all connected clients before removing
    shareServer.broadcastShareRemoved(targetShareId);
    // Small delay to allow message to be sent
    await new Promise(resolve => setTimeout(resolve, 50));
    success = shareManager.removeShare(targetShareId);
  }

  if (!success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.yellow}No share found to remove.${COLORS.reset}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}${ICONS.success}${COLORS.reset} Session sharing disabled. All viewers have been disconnected.`,
      },
    ],
  };
}

/**
 * List all active shares
 */
export async function handleSharesList(params: {}) {
  const shares = shareManager.getAllShares();

  if (shares.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No active shares. Use remote_session_share to start sharing.`,
        },
      ],
    };
  }

  const shareLines = shares.map(share => {
    const session = sessionManager.getSession(share.sessionId);
    const remaining = Math.max(0, share.expiresAt.getTime() - Date.now());
    const remainingMins = Math.floor(remaining / 60000);

    return `${COLORS.cyan}${share.shareId}${COLORS.reset}
  Session: ${session?.name || share.sessionId}
  Permissions: ${share.permissions}
  Password: ${share.password ? "Yes" : "No"}
  Clients: ${share.connectedClients}
  Expires in: ${remainingMins} minutes`;
  });

  const serverStatus = shareServer.isRunning()
    ? `${COLORS.green}running on port ${shareServer.getPort()}${COLORS.reset}`
    : `${COLORS.red}not running${COLORS.reset}`;

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.bold}Active Shares${COLORS.reset} (${shares.length})
Share server: ${serverStatus}

${shareLines.join("\n\n")}`,
      },
    ],
  };
}

/**
 * Update share permissions
 */
export async function handleShareUpdate(params: {
  shareId: string;
  permissions?: "view" | "control";
  extendMinutes?: number;
}) {
  const { shareId, permissions, extendMinutes } = params;

  const share = shareManager.getShare(shareId);
  if (!share) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Share not found: ${shareId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const updates: string[] = [];

  if (permissions) {
    shareManager.updatePermissions(shareId, permissions);
    updates.push(`Permissions: ${permissions}`);
  }

  if (extendMinutes) {
    shareManager.extendExpiration(shareId, extendMinutes * 60 * 1000);
    updates.push(`Extended by ${extendMinutes} minutes`);
  }

  if (updates.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.yellow}No updates specified.${COLORS.reset}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}${ICONS.success}${COLORS.reset} Share updated

${updates.map(u => `  - ${u}`).join("\n")}`,
      },
    ],
  };
}

/**
 * Start share server manually
 */
export async function handleShareServerStart(params: { port?: number }) {
  const { port = 3847 } = params;

  if (shareServer.isRunning()) {
    return {
      content: [
        {
          type: "text",
          text: `Share server already running on port ${shareServer.getPort()}`,
        },
      ],
    };
  }

  try {
    await shareServer.start(port);
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}${ICONS.success}${COLORS.reset} Share server started on port ${port}`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Failed to start share server:${COLORS.reset} ${err.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Stop share server
 */
export async function handleShareServerStop(params: {}) {
  if (!shareServer.isRunning()) {
    return {
      content: [
        {
          type: "text",
          text: `Share server is not running.`,
        },
      ],
    };
  }

  await shareServer.stop();

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}${ICONS.success}${COLORS.reset} Share server stopped. All shares have been disconnected.`,
      },
    ],
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export function getShareToolDefinitions() {
  return [
    {
      name: "remote_session_share",
      description: `Share a terminal session for collaboration.

Creates a shareable URL that others can use to view (or control) your terminal session in real-time.`,
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to share (defaults to active)",
          },
          permissions: {
            type: "string",
            enum: ["view", "control"],
            description: "Permission level (default: view)",
          },
          password: {
            type: "string",
            description: "Optional password protection",
          },
          expiresInMinutes: {
            type: "number",
            description: "Expiration time in minutes (default: 60)",
          },
        },
      },
    },
    {
      name: "remote_session_unshare",
      description: "Stop sharing a session.",
      inputSchema: {
        type: "object",
        properties: {
          shareId: {
            type: "string",
            description: "Share ID to remove",
          },
          sessionId: {
            type: "string",
            description: "Session ID to unshare (alternative to shareId)",
          },
        },
      },
    },
    {
      name: "remote_shares_list",
      description: "List all active session shares.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "remote_share_update",
      description: "Update share settings (permissions, expiration).",
      inputSchema: {
        type: "object",
        properties: {
          shareId: {
            type: "string",
            description: "Share ID to update",
          },
          permissions: {
            type: "string",
            enum: ["view", "control"],
            description: "New permission level",
          },
          extendMinutes: {
            type: "number",
            description: "Extend expiration by this many minutes",
          },
        },
        required: ["shareId"],
      },
    },
    {
      name: "remote_share_server_start",
      description: "Start the share server (usually starts automatically).",
      inputSchema: {
        type: "object",
        properties: {
          port: {
            type: "number",
            description: "Port to listen on (default: 3847)",
          },
        },
      },
    },
    {
      name: "remote_share_server_stop",
      description: "Stop the share server and disconnect all viewers.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}
