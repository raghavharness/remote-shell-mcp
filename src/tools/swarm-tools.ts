import { swarmManager } from "../features/swarm.js";
import { sessionManager } from "../session-manager.js";
import { SwarmTarget, SwarmConnectionMethod } from "../types.js";
import { COLORS } from "../utils/ansi.js";
import { ICONS } from "../utils/terminal-ui.js";

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ============================================================================
// Swarm Tool Handlers
// ============================================================================

/**
 * Create a new swarm
 */
export async function handleSwarmCreate(params: {
  name: string;
  method: SwarmConnectionMethod;
  targets: SwarmTarget[];
  autoReconnect?: boolean;
}): Promise<ToolResult> {
  const { name, method, targets, autoReconnect } = params;

  if (!targets || targets.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} No targets provided. A swarm requires at least one target.`,
        },
      ],
      isError: true,
    };
  }

  try {
    const swarm = await swarmManager.createSwarm(name, method, targets, { autoReconnect });
    const status = swarmManager.getSwarmStatus(swarm.id);

    const statusIcon = swarm.status === "active"
      ? `${COLORS.green}${ICONS.success}${COLORS.reset}`
      : swarm.status === "partial"
        ? `${COLORS.yellow}${ICONS.warning}${COLORS.reset}`
        : `${COLORS.red}${ICONS.error}${COLORS.reset}`;

    const targetList = swarm.targets.map(t => {
      const failed = swarm.failedTargets.includes(t.id);
      const icon = failed ? `${COLORS.red}${ICONS.error}${COLORS.reset}` : `${COLORS.green}${ICONS.connected}${COLORS.reset}`;
      const label = t.host || t.instance || t.targetId || t.vmName || t.command || t.id;
      return `  ${icon} ${t.id}: ${label}`;
    }).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `${statusIcon} **Swarm Created: ${swarm.name}**

${COLORS.cyan}ID:${COLORS.reset} ${swarm.id}
${COLORS.cyan}Method:${COLORS.reset} ${swarm.method}
${COLORS.cyan}Status:${COLORS.reset} ${swarm.status}
${COLORS.cyan}Connected:${COLORS.reset} ${status.connected}/${status.total}

**Targets:**
${targetList}

${swarm.failedTargets.length > 0 ? `\n${COLORS.yellow}Failed to connect:${COLORS.reset} ${swarm.failedTargets.join(", ")}` : ""}

Use ${COLORS.bold}remote_swarm_exec${COLORS.reset} to broadcast commands to all targets.
Use ${COLORS.bold}remote_swarm_end${COLORS.reset} to close all sessions.`,
        },
      ],
      isError: swarm.status === "failed",
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Failed to create swarm: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List all swarms
 */
export async function handleSwarmList(): Promise<ToolResult> {
  const swarms = swarmManager.getAllSwarms();

  if (swarms.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No active swarms. Use ${COLORS.bold}remote_swarm_create${COLORS.reset} to create a swarm.`,
        },
      ],
    };
  }

  const swarmLines = swarms.map(swarm => {
    const status = swarmManager.getSwarmStatus(swarm.id);
    const statusIcon = swarm.status === "active"
      ? `${COLORS.green}${ICONS.connected}${COLORS.reset}`
      : swarm.status === "partial"
        ? `${COLORS.yellow}${ICONS.warning}${COLORS.reset}`
        : `${COLORS.red}${ICONS.error}${COLORS.reset}`;

    return `${statusIcon} **${swarm.name}** (${swarm.id})
  Method: ${swarm.method}
  Targets: ${status.connected}/${status.total} connected
  Created: ${swarm.createdAt.toLocaleTimeString()}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `**Active Swarms (${swarms.length})**

${swarmLines.join("\n\n")}`,
      },
    ],
  };
}

/**
 * Get swarm status/details
 */
export async function handleSwarmStatus(params: { swarmId: string }): Promise<ToolResult> {
  const { swarmId } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const status = swarmManager.getSwarmStatus(swarmId);

  const targetDetails = swarm.targets.map(t => {
    const failed = swarm.failedTargets.includes(t.id);
    const sessionIdx = swarm.targets.filter(x => !swarm.failedTargets.includes(x.id)).indexOf(t);
    const sessionId = !failed && sessionIdx !== -1 && sessionIdx < swarm.sessionIds.length
      ? swarm.sessionIds[sessionIdx]
      : null;
    const session = sessionId ? sessionManager.getSession(sessionId) : null;

    const connStatus = failed
      ? `${COLORS.red}failed${COLORS.reset}`
      : session?.connected
        ? `${COLORS.green}connected${COLORS.reset}`
        : `${COLORS.yellow}disconnected${COLORS.reset}`;

    const label = t.host || t.instance || t.targetId || t.vmName || t.command || t.id;

    return `  - ${t.id}: ${label}
    Status: ${connStatus}${sessionId ? ` | Session: ${sessionId}` : ""}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `**Swarm: ${swarm.name}** (${swarm.id})

${COLORS.cyan}Method:${COLORS.reset} ${swarm.method}
${COLORS.cyan}Status:${COLORS.reset} ${swarm.status}
${COLORS.cyan}Connected:${COLORS.reset} ${status.connected}
${COLORS.cyan}Disconnected:${COLORS.reset} ${status.disconnected}
${COLORS.cyan}Failed:${COLORS.reset} ${status.failed}
${COLORS.cyan}Created:${COLORS.reset} ${swarm.createdAt.toLocaleString()}

**Targets:**
${targetDetails.join("\n")}`,
      },
    ],
  };
}

/**
 * Execute command in swarm (broadcast)
 */
export async function handleSwarmExec(params: {
  swarmId: string;
  command: string;
  waitTime?: number;
  parallel?: boolean;
  stopOnError?: boolean;
}): Promise<ToolResult> {
  const { swarmId, command, waitTime, parallel, stopOnError } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const results = await swarmManager.execInSwarm(swarmId, command, {
      waitTime,
      parallel,
      stopOnError,
    });

    const resultBlocks = results.map(r => {
      const icon = r.isError
        ? `${COLORS.red}${ICONS.error}${COLORS.reset}`
        : `${COLORS.green}${ICONS.success}${COLORS.reset}`;

      return `${icon} **${r.targetId}**
\`\`\`
${r.output}
\`\`\``;
    });

    const successCount = results.filter(r => !r.isError).length;
    const errorCount = results.filter(r => r.isError).length;

    const summaryIcon = errorCount === 0
      ? `${COLORS.green}${ICONS.success}${COLORS.reset}`
      : errorCount === results.length
        ? `${COLORS.red}${ICONS.error}${COLORS.reset}`
        : `${COLORS.yellow}${ICONS.warning}${COLORS.reset}`;

    return {
      content: [
        {
          type: "text",
          text: `${summaryIcon} **Swarm Broadcast: ${swarm.name}**
${COLORS.gray}Command: ${command}${COLORS.reset}
${COLORS.gray}Results: ${successCount} success, ${errorCount} errors${COLORS.reset}

${resultBlocks.join("\n\n")}`,
        },
      ],
      isError: errorCount > 0,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Swarm exec failed: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Send input to all sessions in swarm
 */
export async function handleSwarmInput(params: {
  swarmId: string;
  input: string;
}): Promise<ToolResult> {
  const { swarmId, input } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  try {
    await swarmManager.sendInputToSwarm(swarmId, input + "\n");

    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}${ICONS.success}${COLORS.reset} Sent input to ${swarm.sessionIds.length} session(s) in swarm "${swarm.name}"`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Failed to send input: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Interrupt all sessions in swarm
 */
export async function handleSwarmInterrupt(params: { swarmId: string }): Promise<ToolResult> {
  const { swarmId } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  try {
    await swarmManager.interruptSwarm(swarmId);

    return {
      content: [
        {
          type: "text",
          text: `${COLORS.yellow}^C${COLORS.reset} Sent SIGINT to ${swarm.sessionIds.length} session(s) in swarm "${swarm.name}"`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Failed to interrupt: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * End a swarm
 */
export async function handleSwarmEnd(params: {
  swarmId?: string;
}): Promise<ToolResult> {
  const { swarmId } = params;

  if (swarmId === "all" || !swarmId) {
    const swarms = swarmManager.getAllSwarms();
    if (swarms.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No active swarms to end.",
          },
        ],
      };
    }

    if (!swarmId) {
      // List swarms and ask which to end
      const swarmList = swarms.map(s => `  - ${s.id}: ${s.name}`).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Specify a swarmId to end, or use "all" to end all swarms.

Active swarms:
${swarmList}`,
          },
        ],
      };
    }

    // End all
    const totalCount = await swarmManager.endAllSwarms();
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}${ICONS.success}${COLORS.reset} Ended all swarms (${swarms.length} swarms, ${totalCount} sessions)`,
        },
      ],
    };
  }

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const name = swarm.name;
  const count = await swarmManager.endSwarm(swarmId);

  return {
    content: [
      {
        type: "text",
        text: `${COLORS.green}${ICONS.success}${COLORS.reset} Ended swarm "${name}" (${count} sessions closed)`,
      },
    ],
  };
}

/**
 * Add target to existing swarm
 */
export async function handleSwarmAddTarget(params: {
  swarmId: string;
  target: SwarmTarget;
  autoReconnect?: boolean;
}): Promise<ToolResult> {
  const { swarmId, target, autoReconnect } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const success = await swarmManager.addTargetToSwarm(swarmId, target, { autoReconnect });

  if (success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}${ICONS.success}${COLORS.reset} Added target "${target.id}" to swarm "${swarm.name}"`,
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Failed to add target "${target.id}" to swarm`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Remove target from swarm
 */
export async function handleSwarmRemoveTarget(params: {
  swarmId: string;
  targetId: string;
}): Promise<ToolResult> {
  const { swarmId, targetId } = params;

  const swarm = swarmManager.getSwarm(swarmId);
  if (!swarm) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}Swarm not found: ${swarmId}${COLORS.reset}`,
        },
      ],
      isError: true,
    };
  }

  const success = await swarmManager.removeTargetFromSwarm(swarmId, targetId);

  if (success) {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.green}${ICONS.success}${COLORS.reset} Removed target "${targetId}" from swarm "${swarm.name}"`,
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `${COLORS.red}${ICONS.error}${COLORS.reset} Target "${targetId}" not found in swarm`,
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export function getSwarmToolDefinitions() {
  return [
    {
      name: "remote_swarm_create",
      description: `Create a swarm of parallel SSH sessions to multiple machines.

Swarms allow you to connect to multiple servers simultaneously and broadcast commands.
Useful for managing clusters, fleets, or performing parallel operations.

Example targets for SSH:
  [{ "id": "web1", "host": "10.0.0.1", "username": "admin" },
   { "id": "web2", "host": "10.0.0.2", "username": "admin" }]

Example targets for GCloud:
  [{ "id": "vm1", "instance": "my-vm-1", "zone": "us-central1-a" },
   { "id": "vm2", "instance": "my-vm-2", "zone": "us-central1-a" }]`,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Friendly name for the swarm",
          },
          method: {
            type: "string",
            enum: ["ssh", "gcloud", "aws", "azure", "custom"],
            description: "Connection method for all targets",
          },
          targets: {
            type: "array",
            description: "Array of targets to connect to",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique target identifier" },
                host: { type: "string", description: "SSH hostname (for ssh method)" },
                username: { type: "string", description: "SSH username (for ssh method)" },
                instance: { type: "string", description: "Instance name (for cloud methods)" },
                zone: { type: "string", description: "Zone (for gcloud)" },
                project: { type: "string", description: "Project (for gcloud)" },
                region: { type: "string", description: "Region (for aws)" },
                targetId: { type: "string", description: "SSM target ID (for aws)" },
                vmName: { type: "string", description: "VM name (for azure)" },
                resourceGroup: { type: "string", description: "Resource group (for azure)" },
                command: { type: "string", description: "Custom command (for custom method)" },
              },
            },
          },
          autoReconnect: {
            type: "boolean",
            description: "Enable auto-reconnect for sessions (default: true)",
          },
        },
        required: ["name", "method", "targets"],
      },
    },
    {
      name: "remote_swarm_list",
      description: "List all active swarms with their status.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "remote_swarm_status",
      description: "Get detailed status of a specific swarm including all targets.",
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
        },
        required: ["swarmId"],
      },
    },
    {
      name: "remote_swarm_exec",
      description: `Broadcast a command to all sessions in a swarm (parallel execution).

Returns aggregated output from all targets. Use for running the same command across multiple machines.`,
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
          command: {
            type: "string",
            description: "Command to execute on all targets",
          },
          waitTime: {
            type: "number",
            description: "Override wait time (ms). Uses smart-wait if not provided.",
          },
          parallel: {
            type: "boolean",
            description: "Execute in parallel (default: true). Set false for sequential.",
          },
          stopOnError: {
            type: "boolean",
            description: "Stop on first error when running sequentially",
          },
        },
        required: ["swarmId", "command"],
      },
    },
    {
      name: "remote_swarm_input",
      description: `Send input text to all sessions in a swarm.

Useful for responding to prompts (passwords, confirmations) across all targets.`,
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
          input: {
            type: "string",
            description: "Input text to send (newline appended automatically)",
          },
        },
        required: ["swarmId", "input"],
      },
    },
    {
      name: "remote_swarm_interrupt",
      description: "Send Ctrl+C (SIGINT) to all sessions in a swarm.",
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
        },
        required: ["swarmId"],
      },
    },
    {
      name: "remote_swarm_end",
      description: "End a swarm, closing all its sessions. Use swarmId='all' to end all swarms.",
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID, or 'all' to end all swarms",
          },
        },
      },
    },
    {
      name: "remote_swarm_add_target",
      description: "Add a new target to an existing swarm.",
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
          target: {
            type: "object",
            description: "Target to add",
            properties: {
              id: { type: "string" },
              host: { type: "string" },
              username: { type: "string" },
              instance: { type: "string" },
              zone: { type: "string" },
              project: { type: "string" },
              region: { type: "string" },
              targetId: { type: "string" },
              vmName: { type: "string" },
              resourceGroup: { type: "string" },
              command: { type: "string" },
            },
          },
          autoReconnect: {
            type: "boolean",
            description: "Enable auto-reconnect (default: true)",
          },
        },
        required: ["swarmId", "target"],
      },
    },
    {
      name: "remote_swarm_remove_target",
      description: "Remove a target from a swarm (closes its session).",
      inputSchema: {
        type: "object",
        properties: {
          swarmId: {
            type: "string",
            description: "Swarm ID",
          },
          targetId: {
            type: "string",
            description: "Target ID to remove",
          },
        },
        required: ["swarmId", "targetId"],
      },
    },
  ];
}
