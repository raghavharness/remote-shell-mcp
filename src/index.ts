#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Core modules
import { sessionManager } from "./session-manager.js";
import { extractSessionName } from "./utils/patterns.js";

// Tools
import {
  handleShellTool,
  getShellToolDefinition,
  handleSessionStatus,
  handleSessionSwitch,
  handleSessionEnd,
  handleSessionHistory,
  handleSessionOutput,
  handleSessionSignal,
  handleOutputSearch,
  handleFindErrors,
  getSessionToolDefinitions,
  handleFileUpload,
  handleFileDownload,
  handleListRemote,
  getFileToolDefinitions,
  handleStartLocalForward,
  handleStartRemoteForward,
  handleListPortForwards,
  handleStopPortForward,
  handleStopAllPortForwards,
  getPortToolDefinitions,
} from "./tools/index.js";

// Prompts
import { getPromptDefinitions, handlePrompt } from "./prompts/index.js";

// Features
import { directoryTracker } from "./features/directory-tracker.js";

const VERSION = "3.0.0";

class RemoteShellServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "remote-shell",
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers();
  }

  private setupToolHandlers() {
    // List all tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        getShellToolDefinition(),
        ...getSessionToolDefinitions(),
        ...getFileToolDefinitions(),
        ...getPortToolDefinitions(),
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const params = (args || {}) as Record<string, any>;

      try {
        switch (name) {
          // Main shell tool
          case "shell":
            return await handleShellTool(params as any);

          // Session management tools
          case "remote_session_start":
            return await this.handleSessionStart(params);

          case "remote_session_status":
            return await handleSessionStatus();

          case "remote_session_switch":
            return await handleSessionSwitch(params as any);

          case "remote_session_end":
            return await handleSessionEnd(params as any);

          case "remote_session_history":
            return await handleSessionHistory(params as any);

          case "remote_session_output":
            return await handleSessionOutput(params as any);

          case "remote_session_signal":
            return await handleSessionSignal(params as any);

          case "remote_session_search":
            return await handleOutputSearch(params as any);

          case "remote_session_errors":
            return await handleFindErrors(params as any);

          // File transfer tools
          case "remote_file_upload":
            return await handleFileUpload(params as any);

          case "remote_file_download":
            return await handleFileDownload(params as any);

          case "remote_file_list":
            return await handleListRemote(params as any);

          // Port forwarding tools
          case "remote_port_forward_local":
            return await handleStartLocalForward(params as any);

          case "remote_port_forward_remote":
            return await handleStartRemoteForward(params as any);

          case "remote_port_list":
            return await handleListPortForwards(params as any);

          case "remote_port_stop":
            return await handleStopPortForward(params as any);

          case "remote_port_stop_all":
            return await handleStopAllPortForwards(params as any);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `**Error:** ${error.message || String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleSessionStart(params: Record<string, any>) {
    const { method, autoReconnect = true } = params;

    switch (method) {
      case "ssh": {
        const { host, username, port, password, privateKeyPath } = params;
        if (!host || !username) {
          throw new Error("host and username required for SSH");
        }

        const session = await sessionManager.startSsh2Session(host, username, {
          port,
          password,
          privateKeyPath,
          autoReconnect,
        });

        return {
          content: [
            {
              type: "text",
              text: `**Remote session started: ${session.name}**

Session ID: ${session.id}
Type: ${session.type}
Status: ${session.connected ? "Connected" : "Connecting..."}
Working Directory: ${directoryTracker.getCurrentDirectory(session.id)}
Auto-reconnect: ${session.autoReconnect ? "enabled" : "disabled"}

Use \`shell\` tool to run commands. Type \`//end\` to end session.`,
            },
          ],
        };
      }

      case "gcloud": {
        const { instance, zone, project, sessionName } = params;
        if (!instance) throw new Error("instance required for gcloud");

        const gcloudArgs = ["compute", "ssh", instance];
        if (zone) gcloudArgs.push(`--zone=${zone}`);
        if (project) gcloudArgs.push(`--project=${project}`);

        const cmd = `gcloud ${gcloudArgs.join(" ")}`;
        const session = await sessionManager.startChildProcessSession(
          "gcloud",
          gcloudArgs,
          sessionName || `gcloud:${instance}`,
          `GCloud SSH to ${instance}`,
          cmd,
          { autoReconnect }
        );

        return this.formatSessionStarted(session);
      }

      case "aws": {
        const { targetId, region, sessionName } = params;
        if (!targetId) throw new Error("targetId required for AWS");

        const awsArgs = ["ssm", "start-session", "--target", targetId];
        if (region) awsArgs.push("--region", region);

        const cmd = `aws ${awsArgs.join(" ")}`;
        const session = await sessionManager.startChildProcessSession(
          "aws",
          awsArgs,
          sessionName || `aws:${targetId}`,
          `AWS SSM to ${targetId}`,
          cmd,
          { autoReconnect }
        );

        return this.formatSessionStarted(session);
      }

      case "azure": {
        const { vmName, resourceGroup, sessionName } = params;
        if (!vmName || !resourceGroup) {
          throw new Error("vmName and resourceGroup required for Azure");
        }

        const azArgs = ["ssh", "vm", "--name", vmName, "-g", resourceGroup];
        const cmd = `az ${azArgs.join(" ")}`;
        const session = await sessionManager.startChildProcessSession(
          "az",
          azArgs,
          sessionName || `azure:${vmName}`,
          `Azure SSH to ${vmName}`,
          cmd,
          { autoReconnect }
        );

        return this.formatSessionStarted(session);
      }

      case "custom": {
        const { command, sessionName } = params;
        if (!command) throw new Error("command required for custom");

        const parts = command.split(/\s+/);
        const session = await sessionManager.startChildProcessSession(
          parts[0],
          parts.slice(1),
          sessionName || extractSessionName(command),
          `Custom: ${command}`,
          command,
          { autoReconnect }
        );

        return this.formatSessionStarted(session);
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private formatSessionStarted(session: any) {
    const initialOutput = session.outputBuffer.join("").slice(-1500);

    return {
      content: [
        {
          type: "text",
          text: `**Remote session started: ${session.name}**

Session ID: ${session.id}
Type: ${session.type}
Status: ${session.connected ? "Connected" : "Connecting..."}
Working Directory: ${directoryTracker.getCurrentDirectory(session.id)}
Auto-reconnect: ${session.autoReconnect ? "enabled" : "disabled"}

---
${initialOutput || "(connecting...)"}
---

Use \`shell\` tool to run commands. Type \`//end\` to end session.`,
        },
      ],
    };
  }

  private setupPromptHandlers() {
    // List prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: getPromptDefinitions(),
    }));

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await handlePrompt(name, args as Record<string, string>);
      return result as any;
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Remote Shell MCP server v${VERSION} running on stdio`);
    console.error("Features: file-transfer, port-forwarding, smart-wait, directory-tracking, streaming, auto-reconnect");
  }
}

const server = new RemoteShellServer();
server.run().catch(console.error);
