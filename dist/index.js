#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Core modules
import { sessionManager } from "./session-manager.js";
import { extractSessionName } from "./utils/patterns.js";
// Tools
import { handleShellTool, getShellToolDefinition, handleSessionStatus, handleSessionSwitch, handleSessionEnd, handleSessionHistory, handleSessionOutput, handleSessionSignal, handleOutputSearch, handleFindErrors, getSessionToolDefinitions, handleFileUpload, handleFileDownload, handleListRemote, getFileToolDefinitions, handleStartLocalForward, handleStartRemoteForward, handleListPortForwards, handleStopPortForward, handleStopAllPortForwards, getPortToolDefinitions, handleBlocksList, handleBlockGet, handleBlocksSearch, handleBlockCopy, handleBlockTag, handleBlockUntag, handleBlockCollapse, handleBlocksErrors, getBlockToolDefinitions, handlePaneSplit, handlePaneFocus, handlePaneClose, handlePaneList, handlePaneExec, handlePaneBroadcast, handlePaneRename, handlePaneNext, getPaneToolDefinitions, handleSessionShare, handleSessionUnshare, handleSharesList, handleShareUpdate, handleShareServerStart, handleShareServerStop, getShareToolDefinitions, 
// Swarm tools (v5.0)
handleSwarmCreate, handleSwarmList, handleSwarmStatus, handleSwarmExec, handleSwarmInput, handleSwarmInterrupt, handleSwarmEnd, handleSwarmAddTarget, handleSwarmRemoveTarget, getSwarmToolDefinitions, 
// Input/Streaming tools (v5.0)
handleSessionInput, handleCheckPrompt, handleConfirm, handleSendPassword, handleEnableStreaming, handleDisableStreaming, handleStreamingStatus, getInputToolDefinitions, } from "./tools/index.js";
// Prompts
import { getPromptDefinitions, handlePrompt } from "./prompts/index.js";
// Features
import { directoryTracker } from "./features/directory-tracker.js";
const VERSION = "5.0.0";
class RemoteShellServer {
    server;
    constructor() {
        this.server = new Server({
            name: "remote-shell",
            version: VERSION,
        }, {
            capabilities: {
                tools: {},
                prompts: {},
            },
        });
        this.setupToolHandlers();
        this.setupPromptHandlers();
    }
    setupToolHandlers() {
        // List all tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                getShellToolDefinition(),
                ...getSessionToolDefinitions(),
                ...getFileToolDefinitions(),
                ...getPortToolDefinitions(),
                ...getBlockToolDefinitions(),
                ...getPaneToolDefinitions(),
                ...getShareToolDefinitions(),
                ...getSwarmToolDefinitions(),
                ...getInputToolDefinitions(),
            ],
        }));
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const params = (args || {});
            try {
                switch (name) {
                    // Main shell tool
                    case "shell":
                        return await handleShellTool(params);
                    // Session management tools
                    case "remote_session_start":
                        return await this.handleSessionStart(params);
                    case "remote_session_status":
                        return await handleSessionStatus();
                    case "remote_session_switch":
                        return await handleSessionSwitch(params);
                    case "remote_session_end":
                        return await handleSessionEnd(params);
                    case "remote_session_history":
                        return await handleSessionHistory(params);
                    case "remote_session_output":
                        return await handleSessionOutput(params);
                    case "remote_session_signal":
                        return await handleSessionSignal(params);
                    case "remote_session_search":
                        return await handleOutputSearch(params);
                    case "remote_session_errors":
                        return await handleFindErrors(params);
                    // File transfer tools
                    case "remote_file_upload":
                        return await handleFileUpload(params);
                    case "remote_file_download":
                        return await handleFileDownload(params);
                    case "remote_file_list":
                        return await handleListRemote(params);
                    // Port forwarding tools
                    case "remote_port_forward_local":
                        return await handleStartLocalForward(params);
                    case "remote_port_forward_remote":
                        return await handleStartRemoteForward(params);
                    case "remote_port_list":
                        return await handleListPortForwards(params);
                    case "remote_port_stop":
                        return await handleStopPortForward(params);
                    case "remote_port_stop_all":
                        return await handleStopAllPortForwards(params);
                    // Block tools
                    case "remote_blocks_list":
                        return await handleBlocksList(params);
                    case "remote_block_get":
                        return await handleBlockGet(params);
                    case "remote_blocks_search":
                        return await handleBlocksSearch(params);
                    case "remote_block_copy":
                        return await handleBlockCopy(params);
                    case "remote_block_tag":
                        return await handleBlockTag(params);
                    case "remote_block_untag":
                        return await handleBlockUntag(params);
                    case "remote_block_collapse":
                        return await handleBlockCollapse(params);
                    case "remote_blocks_errors":
                        return await handleBlocksErrors(params);
                    // Pane tools
                    case "remote_pane_split":
                        return await handlePaneSplit(params);
                    case "remote_pane_focus":
                        return await handlePaneFocus(params);
                    case "remote_pane_close":
                        return await handlePaneClose(params);
                    case "remote_pane_list":
                        return await handlePaneList(params);
                    case "remote_pane_exec":
                        return await handlePaneExec(params);
                    case "remote_pane_broadcast":
                        return await handlePaneBroadcast(params);
                    case "remote_pane_rename":
                        return await handlePaneRename(params);
                    case "remote_pane_next":
                        return await handlePaneNext(params);
                    // Share tools
                    case "remote_session_share":
                        return await handleSessionShare(params);
                    case "remote_session_unshare":
                        return await handleSessionUnshare(params);
                    case "remote_shares_list":
                        return await handleSharesList(params);
                    case "remote_share_update":
                        return await handleShareUpdate(params);
                    case "remote_share_server_start":
                        return await handleShareServerStart(params);
                    case "remote_share_server_stop":
                        return await handleShareServerStop(params);
                    // Swarm tools (v5.0)
                    case "remote_swarm_create":
                        return await handleSwarmCreate(params);
                    case "remote_swarm_list":
                        return await handleSwarmList();
                    case "remote_swarm_status":
                        return await handleSwarmStatus(params);
                    case "remote_swarm_exec":
                        return await handleSwarmExec(params);
                    case "remote_swarm_input":
                        return await handleSwarmInput(params);
                    case "remote_swarm_interrupt":
                        return await handleSwarmInterrupt(params);
                    case "remote_swarm_end":
                        return await handleSwarmEnd(params);
                    case "remote_swarm_add_target":
                        return await handleSwarmAddTarget(params);
                    case "remote_swarm_remove_target":
                        return await handleSwarmRemoveTarget(params);
                    // Input/Streaming tools (v5.0)
                    case "remote_session_input":
                        return await handleSessionInput(params);
                    case "remote_session_check_prompt":
                        return await handleCheckPrompt(params);
                    case "remote_session_confirm":
                        return await handleConfirm(params);
                    case "remote_session_password":
                        return await handleSendPassword(params);
                    case "remote_stream_enable":
                        return await handleEnableStreaming(params);
                    case "remote_stream_disable":
                        return await handleDisableStreaming(params);
                    case "remote_stream_status":
                        return await handleStreamingStatus(params);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
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
    async handleSessionStart(params) {
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
                if (!instance)
                    throw new Error("instance required for gcloud");
                const gcloudArgs = ["compute", "ssh", instance];
                if (zone)
                    gcloudArgs.push(`--zone=${zone}`);
                if (project)
                    gcloudArgs.push(`--project=${project}`);
                const cmd = `gcloud ${gcloudArgs.join(" ")}`;
                const session = await sessionManager.startChildProcessSession("gcloud", gcloudArgs, sessionName || `gcloud:${instance}`, `GCloud SSH to ${instance}`, cmd, { autoReconnect });
                return this.formatSessionStarted(session);
            }
            case "aws": {
                const { targetId, region, sessionName } = params;
                if (!targetId)
                    throw new Error("targetId required for AWS");
                const awsArgs = ["ssm", "start-session", "--target", targetId];
                if (region)
                    awsArgs.push("--region", region);
                const cmd = `aws ${awsArgs.join(" ")}`;
                const session = await sessionManager.startChildProcessSession("aws", awsArgs, sessionName || `aws:${targetId}`, `AWS SSM to ${targetId}`, cmd, { autoReconnect });
                return this.formatSessionStarted(session);
            }
            case "azure": {
                const { vmName, resourceGroup, sessionName } = params;
                if (!vmName || !resourceGroup) {
                    throw new Error("vmName and resourceGroup required for Azure");
                }
                const azArgs = ["ssh", "vm", "--name", vmName, "-g", resourceGroup];
                const cmd = `az ${azArgs.join(" ")}`;
                const session = await sessionManager.startChildProcessSession("az", azArgs, sessionName || `azure:${vmName}`, `Azure SSH to ${vmName}`, cmd, { autoReconnect });
                return this.formatSessionStarted(session);
            }
            case "custom": {
                const { command, sessionName } = params;
                if (!command)
                    throw new Error("command required for custom");
                const parts = command.split(/\s+/);
                const session = await sessionManager.startChildProcessSession(parts[0], parts.slice(1), sessionName || extractSessionName(command), `Custom: ${command}`, command, { autoReconnect });
                return this.formatSessionStarted(session);
            }
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }
    formatSessionStarted(session) {
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
    setupPromptHandlers() {
        // List prompts
        this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
            prompts: getPromptDefinitions(),
        }));
        // Handle prompt requests
        this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const result = await handlePrompt(name, args);
            return result;
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`Remote Shell MCP server v${VERSION} running on stdio`);
        console.error("Features: blocks, panes, sharing, file-transfer, port-forwarding, smart-wait, auto-reconnect, swarm, streaming, tty-input");
    }
}
const server = new RemoteShellServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map