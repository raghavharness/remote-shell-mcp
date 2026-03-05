import { blockManager } from "../features/blocks.js";
import { sessionManager } from "../session-manager.js";
import { COLORS } from "../utils/ansi.js";
import { formatUptime } from "../utils/terminal-ui.js";

// ============================================================================
// Block Tool Handlers
// ============================================================================

/**
 * List blocks for a session
 */
export async function handleBlocksList(params: {
  sessionId?: string;
  limit?: number;
  showCollapsed?: boolean;
}) {
  const { sessionId, limit = 20, showCollapsed = true } = params;

  // Use active session if not specified
  const targetSessionId = sessionId || sessionManager.getActiveSessionId();

  if (!targetSessionId) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.yellow}No active session. Specify sessionId or start a remote session first.${COLORS.reset}`,
        },
      ],
    };
  }

  const blocks = blockManager.getSessionBlocks(targetSessionId, limit);
  const session = sessionManager.getSession(targetSessionId);

  if (blocks.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No blocks found for session ${session?.name || targetSessionId}.`,
        },
      ],
    };
  }

  const blockLines = blocks.map((block, index) => {
    const status = block.isError
      ? `${COLORS.red}ERROR${COLORS.reset}`
      : `${COLORS.green}OK${COLORS.reset}`;
    const collapsed = block.collapsed ? " [collapsed]" : "";
    const tags = block.tags.length > 0 ? ` [${block.tags.join(", ")}]` : "";
    const time = block.completedAt.toLocaleTimeString();
    const duration = block.completedAt.getTime() - block.startedAt.getTime();

    let preview = block.collapsed && !showCollapsed
      ? "(collapsed)"
      : block.output.split("\n")[0]?.substring(0, 60) || "(no output)";

    return `${COLORS.cyan}${block.id}${COLORS.reset} | ${status} | ${time} | ${duration}ms${collapsed}${tags}
  ${COLORS.dim}$${COLORS.reset} ${block.command}
  ${COLORS.gray}${preview}${block.output.split("\n").length > 1 ? "..." : ""}${COLORS.reset}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.bold}Blocks for ${session?.name || targetSessionId}${COLORS.reset} (${blocks.length}/${blockManager.getBlockCount(targetSessionId)})

${blockLines.join("\n\n")}

${COLORS.gray}Use remote_block_get(blockId) to view full block output.${COLORS.reset}`,
      },
    ],
  };
}

/**
 * Get a specific block
 */
export async function handleBlockGet(params: { blockId: string; raw?: boolean }) {
  const { blockId, raw = false } = params;

  const block = blockManager.getBlock(blockId);
  if (!block) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Block not found: ${blockId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const session = sessionManager.getSession(block.sessionId);
  const duration = block.completedAt.getTime() - block.startedAt.getTime();
  const status = block.isError
    ? `${COLORS.red}ERROR${COLORS.reset}`
    : `${COLORS.green}OK${COLORS.reset}`;

  if (raw) {
    return {
      content: [
        {
          type: "text",
          text: block.output,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.gray}╭${"─".repeat(60)}╮${COLORS.reset}
${COLORS.gray}│${COLORS.reset} ${COLORS.cyan}${COLORS.bold}Block: ${block.id}${COLORS.reset}${" ".repeat(Math.max(0, 51 - block.id.length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}├${"─".repeat(60)}┤${COLORS.reset}
${COLORS.gray}│${COLORS.reset} Session: ${session?.name || block.sessionId}${" ".repeat(Math.max(0, 49 - (session?.name || block.sessionId).length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} Status: ${status}${" ".repeat(40)}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} Time: ${block.completedAt.toLocaleString()}${" ".repeat(Math.max(0, 38))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} Duration: ${duration}ms${" ".repeat(Math.max(0, 46 - String(duration).length))}${COLORS.gray}│${COLORS.reset}
${COLORS.gray}│${COLORS.reset} Directory: ${block.workingDirectory}${" ".repeat(Math.max(0, 47 - block.workingDirectory.length))}${COLORS.gray}│${COLORS.reset}
${block.tags.length > 0 ? `${COLORS.gray}│${COLORS.reset} Tags: ${block.tags.join(", ")}${" ".repeat(Math.max(0, 52 - block.tags.join(", ").length))}${COLORS.gray}│${COLORS.reset}\n` : ""}${COLORS.gray}╰${"─".repeat(60)}╯${COLORS.reset}

${COLORS.cyan}$${COLORS.reset} ${block.command}

${block.output}`,
      },
    ],
  };
}

/**
 * Search blocks
 */
export async function handleBlocksSearch(params: {
  query: string;
  sessionId?: string;
  regex?: boolean;
  limit?: number;
  tags?: string[];
}) {
  const { query, sessionId, regex, limit = 20, tags } = params;

  const results = blockManager.searchBlocks({
    query,
    sessionId: sessionId || sessionManager.getActiveSessionId() || undefined,
    regex,
    limit,
    tags,
  });

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No matches found for "${query}"${tags ? ` with tags [${tags.join(", ")}]` : ""}.`,
        },
      ],
    };
  }

  const resultLines = results.map((r, i) => {
    return `${COLORS.cyan}${r.blockId}${COLORS.reset} | ${r.timestamp.toLocaleTimeString()}
  ${COLORS.dim}$${COLORS.reset} ${r.command}
  ${COLORS.yellow}Match:${COLORS.reset} ${r.matchedText}
  ${r.context ? `${COLORS.gray}${r.context}${COLORS.reset}` : ""}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.bold}Search Results for "${query}"${COLORS.reset} (${results.length} matches)

${resultLines.join("\n\n")}`,
      },
    ],
  };
}

/**
 * Copy block output (returns clean output only)
 */
export async function handleBlockCopy(params: { blockId: string; stripAnsi?: boolean }) {
  const { blockId, stripAnsi = true } = params;

  const output = blockManager.getBlockOutput(blockId, stripAnsi);
  if (output === null) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Block not found: ${blockId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Tag a block
 */
export async function handleBlockTag(params: { blockId: string; tags: string[] }) {
  const { blockId, tags } = params;

  if (!tags || tags.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.yellow}No tags specified.${COLORS.reset}`,
        },
      ],
    };
  }

  const success = blockManager.tagBlock(blockId, tags);
  if (!success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Block not found: ${blockId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const block = blockManager.getBlock(blockId);
  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}Tagged ${blockId}${COLORS.reset} with: ${tags.join(", ")}
Current tags: [${block?.tags.join(", ")}]`,
      },
    ],
  };
}

/**
 * Remove tags from a block
 */
export async function handleBlockUntag(params: { blockId: string; tags: string[] }) {
  const { blockId, tags } = params;

  const success = blockManager.untagBlock(blockId, tags);
  if (!success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Block not found: ${blockId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const block = blockManager.getBlock(blockId);
  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}Removed tags${COLORS.reset} from ${blockId}: ${tags.join(", ")}
Current tags: [${block?.tags.join(", ") || "none"}]`,
      },
    ],
  };
}

/**
 * Toggle or set block collapsed state
 */
export async function handleBlockCollapse(params: { blockId: string; collapsed?: boolean }) {
  const { blockId, collapsed } = params;

  let success: boolean;
  if (collapsed !== undefined) {
    success = blockManager.setCollapsed(blockId, collapsed);
  } else {
    success = blockManager.toggleCollapsed(blockId);
  }

  if (!success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Block not found: ${blockId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const block = blockManager.getBlock(blockId);
  return {
    content: [
      {
        type: "text",
        text: `Block ${blockId} is now ${block?.collapsed ? "collapsed" : "expanded"}.`,
      },
    ],
  };
}

/**
 * Get error blocks
 */
export async function handleBlocksErrors(params: { sessionId?: string; limit?: number }) {
  const { sessionId, limit = 10 } = params;

  const targetSessionId = sessionId || sessionManager.getActiveSessionId() || undefined;
  const errorBlocks = blockManager.findErrorBlocks(targetSessionId).slice(-limit);

  if (errorBlocks.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}No error blocks found.${COLORS.reset}`,
        },
      ],
    };
  }

  const blockLines = errorBlocks.map(block => {
    const firstErrorLine = block.output.split("\n").find(line =>
      /error|fail|exception|denied|not found/i.test(line)
    ) || block.output.split("\n")[0];

    return `${COLORS.red}${block.id}${COLORS.reset} | ${block.completedAt.toLocaleTimeString()}
  ${COLORS.dim}$${COLORS.reset} ${block.command}
  ${COLORS.red}${firstErrorLine?.substring(0, 100)}${COLORS.reset}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.bold}${COLORS.red}Error Blocks${COLORS.reset} (${errorBlocks.length})

${blockLines.join("\n\n")}

${COLORS.gray}Use remote_block_get(blockId) to view full error output.${COLORS.reset}`,
      },
    ],
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export function getBlockToolDefinitions() {
  return [
    {
      name: "remote_blocks_list",
      description: `List command blocks for a session.

Each command execution creates a "block" containing the command and its output.
Blocks can be searched, tagged, and referenced by ID.`,
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID (defaults to active session)",
          },
          limit: {
            type: "number",
            description: "Maximum blocks to return (default: 20)",
          },
          showCollapsed: {
            type: "boolean",
            description: "Show preview of collapsed blocks (default: true)",
          },
        },
      },
    },
    {
      name: "remote_block_get",
      description: `Get a specific block by ID with full output.

Returns the complete command and output for a block.`,
      inputSchema: {
        type: "object",
        properties: {
          blockId: {
            type: "string",
            description: "Block ID (e.g., block-1, block-5)",
          },
          raw: {
            type: "boolean",
            description: "Return raw output only, no formatting (default: false)",
          },
        },
        required: ["blockId"],
      },
    },
    {
      name: "remote_blocks_search",
      description: `Search through command blocks.

Search command history and output across blocks.`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          sessionId: {
            type: "string",
            description: "Limit to specific session (defaults to active)",
          },
          regex: {
            type: "boolean",
            description: "Treat query as regex (default: false)",
          },
          limit: {
            type: "number",
            description: "Max results (default: 20)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Filter by tags",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "remote_block_copy",
      description: `Get block output only (for copying).

Returns just the output without the command or metadata.`,
      inputSchema: {
        type: "object",
        properties: {
          blockId: {
            type: "string",
            description: "Block ID",
          },
          stripAnsi: {
            type: "boolean",
            description: "Strip ANSI codes (default: true)",
          },
        },
        required: ["blockId"],
      },
    },
    {
      name: "remote_block_tag",
      description: `Add tags to a block for organization.

Tags can be used to filter blocks when searching.`,
      inputSchema: {
        type: "object",
        properties: {
          blockId: {
            type: "string",
            description: "Block ID",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to add",
          },
        },
        required: ["blockId", "tags"],
      },
    },
    {
      name: "remote_block_untag",
      description: "Remove tags from a block.",
      inputSchema: {
        type: "object",
        properties: {
          blockId: {
            type: "string",
            description: "Block ID",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to remove",
          },
        },
        required: ["blockId", "tags"],
      },
    },
    {
      name: "remote_block_collapse",
      description: "Toggle or set block collapsed state.",
      inputSchema: {
        type: "object",
        properties: {
          blockId: {
            type: "string",
            description: "Block ID",
          },
          collapsed: {
            type: "boolean",
            description: "Set collapsed state (omit to toggle)",
          },
        },
        required: ["blockId"],
      },
    },
    {
      name: "remote_blocks_errors",
      description: `Find error blocks in session history.

Returns blocks that had errors (non-zero exit or error patterns).`,
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID (defaults to active)",
          },
          limit: {
            type: "number",
            description: "Max blocks to return (default: 10)",
          },
        },
      },
    },
  ];
}
