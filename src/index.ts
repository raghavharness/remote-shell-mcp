#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn, ChildProcess } from "child_process";
import { Client, ConnectConfig } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Strip ANSI escape codes for cleaner output (used sparingly)
function stripAnsi(str: string): string {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

// ANSI color codes for terminal-like output formatting
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background colors
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
};

// Format the prompt/input line with color
function formatPrompt(sessionName: string, command: string): string {
  return `${COLORS.bold}${COLORS.green}[${sessionName}]${COLORS.reset} ${COLORS.bold}${COLORS.cyan}$ ${command}${COLORS.reset}`;
}

// Format output separator
function formatOutputStart(): string {
  return `${COLORS.dim}${COLORS.gray}────────────────────────────────────────${COLORS.reset}`;
}

function formatOutputEnd(): string {
  return `${COLORS.dim}${COLORS.gray}────────────────────────────────────────${COLORS.reset}`;
}

// Session exit patterns - use special sequences to avoid conflict with Claude
const SESSION_EXIT_PATTERNS = [
  /^~\.$/,                    // SSH-style escape: ~.
  /^\/\/end$/i,               // //end
  /^\/\/exit$/i,              // //exit
  /^\/\/quit$/i,              // //quit
  /^\/\/close$/i,             // //close
  /^\/\/disconnect$/i,        // //disconnect
];

function isSessionExitCommand(command: string): boolean {
  const trimmed = command.trim();
  return SESSION_EXIT_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Interrupt patterns - send Ctrl+C / SIGINT
const SESSION_INTERRUPT_PATTERNS = [
  /^\/\/stop$/i,              // //stop
  /^\/\/kill$/i,              // //kill
  /^\/\/interrupt$/i,         // //interrupt
  /^\/\/ctrl-?c$/i,           // //ctrl-c or //ctrlc
  /^~c$/i,                    // ~c (SSH-style)
];

function isSessionInterruptCommand(command: string): boolean {
  const trimmed = command.trim();
  return SESSION_INTERRUPT_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Stale session timeout (1 hour in milliseconds)
const STALE_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// Patterns that indicate a remote shell command
const REMOTE_COMMAND_PATTERNS = [
  /^gcloud\s+compute\s+ssh\b/,
  /^gcloud\s+.*\s+ssh\b/,
  /^ssh\s+/,
  /^aws\s+ssm\s+start-session\b/,
  /^az\s+ssh\s+vm\b/,
  /^az\s+vm\s+ssh\b/,
  /^kubectl\s+exec\s+.*-it/,
  /^docker\s+exec\s+.*-it/,
  /^vagrant\s+ssh\b/,
  /^heroku\s+run\s+bash\b/,
  /^fly\s+ssh\s+console\b/,
];

// Check if a command opens a remote shell
function isRemoteShellCommand(command: string): boolean {
  const trimmed = command.trim();
  return REMOTE_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// Extract a friendly name from the command
function extractSessionName(command: string): string {
  const trimmed = command.trim();

  // gcloud compute ssh instance-name
  const gcloudMatch = trimmed.match(
    /gcloud\s+compute\s+ssh\s+["']?([^\s"']+)["']?/
  );
  if (gcloudMatch) return `gcloud:${gcloudMatch[1]}`;

  // ssh user@host or ssh host
  const sshMatch = trimmed.match(/ssh\s+(?:-[^\s]+\s+)*(?:(\S+)@)?(\S+)/);
  if (sshMatch) {
    const user = sshMatch[1] || "user";
    const host = sshMatch[2];
    return `ssh:${user}@${host}`;
  }

  // aws ssm start-session --target i-xxx
  const awsMatch = trimmed.match(/--target\s+["']?([^\s"']+)["']?/);
  if (awsMatch) return `aws:${awsMatch[1]}`;

  // az ssh vm --name xxx
  const azMatch = trimmed.match(/--name\s+["']?([^\s"']+)["']?/);
  if (azMatch) return `azure:${azMatch[1]}`;

  // kubectl exec pod-name
  const kubectlMatch = trimmed.match(/kubectl\s+exec\s+(?:-[^\s]+\s+)*(\S+)/);
  if (kubectlMatch) return `k8s:${kubectlMatch[1]}`;

  // docker exec container
  const dockerMatch = trimmed.match(/docker\s+exec\s+(?:-[^\s]+\s+)*(\S+)/);
  if (dockerMatch) return `docker:${dockerMatch[1]}`;

  return `remote:${Date.now()}`;
}

interface ShellSession {
  id: string;
  type: "child_process" | "ssh2";
  name: string;
  description: string;
  originalCommand: string;
  connected: boolean;
  startedAt: Date;
  lastActivity: Date;
  outputBuffer: string[];
  commandHistory: Array<{ command: string; output: string; timestamp: Date }>;
  workingDirectory: string;
  childProcess?: ChildProcess;
  sshClient?: Client;
}

class RemoteShellServer {
  private server: Server;
  private sessions: Map<string, ShellSession> = new Map();
  private activeSessionId: string | null = null;
  private sessionCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "remote-shell",
        version: "2.2.0",
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
    this.startStaleSessionCleanup();
  }

  // Cleanup stale sessions (no activity for 1 hour)
  private startStaleSessionCleanup() {
    // Check every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupStaleSessions() {
    const now = Date.now();
    const staleSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const lastActivityTime = session.lastActivity.getTime();
      const idleTime = now - lastActivityTime;

      if (idleTime >= STALE_SESSION_TIMEOUT_MS) {
        staleSessionIds.push(sessionId);
        console.error(`[remote-shell] Cleaning up stale session: ${session.name} (idle for ${Math.round(idleTime / 60000)} minutes)`);

        // Terminate the session
        if (session.childProcess) {
          session.childProcess.stdin?.write("exit\n");
          setTimeout(() => session.childProcess?.kill(), 500);
        }
        if (session.sshClient) {
          session.sshClient.end();
        }
      }
    }

    // Remove stale sessions
    for (const sessionId of staleSessionIds) {
      this.sessions.delete(sessionId);
    }

    // Update active session if it was cleaned up
    if (this.activeSessionId && staleSessionIds.includes(this.activeSessionId)) {
      const remaining = Array.from(this.sessions.keys());
      this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
    }
  }

  private generateSessionId(): string {
    return `session-${++this.sessionCounter}`;
  }

  private async startChildProcessSession(
    command: string,
    args: string[],
    name: string,
    description: string,
    originalCommand: string
  ): Promise<ShellSession> {
    const sessionId = this.generateSessionId();

    let childProc: ChildProcess;

    // Modify SSH commands to force TTY allocation for interactive use
    let modifiedCommand = originalCommand;
    let modifiedArgs = [...args];

    if (command === "ssh") {
      // Add -tt to force pseudo-terminal allocation
      // Add StrictHostKeyChecking=accept-new to auto-accept new host keys
      const sshOptions: string[] = [];

      if (!args.includes("-t") && !args.includes("-tt")) {
        sshOptions.push("-tt");
      }

      // Auto-accept new host keys (still warns on changed keys for security)
      if (!args.some(arg => arg.includes("StrictHostKeyChecking"))) {
        sshOptions.push("-o", "StrictHostKeyChecking=accept-new");
      }

      if (sshOptions.length > 0) {
        modifiedArgs = [...sshOptions, ...args];
        modifiedCommand = `ssh ${sshOptions.join(" ")} ${args.join(" ")}`;
      }
    } else if (command === "gcloud" && originalCommand.includes("compute ssh")) {
      // For gcloud ssh, add -- to pass SSH options: TTY and auto-accept host keys
      if (!originalCommand.includes("-- ")) {
        const sshFlags = "-t -t -o StrictHostKeyChecking=accept-new";
        modifiedArgs = [...args, "--", ...sshFlags.split(" ")];
        modifiedCommand = `${originalCommand} -- ${sshFlags}`;
      }
    }

    // Spawn the command directly with shell for proper handling
    childProc = spawn(modifiedCommand, [], {
      cwd: homedir(),
      env: { ...process.env, TERM: "xterm-256color" },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    const session: ShellSession = {
      id: sessionId,
      type: "child_process",
      name,
      description,
      originalCommand,
      connected: true,
      startedAt: new Date(),
      lastActivity: new Date(),
      outputBuffer: [],
      commandHistory: [],
      workingDirectory: "~",
      childProcess: childProc,
    };

    childProc.stdout?.on("data", (data: Buffer) => {
      session.outputBuffer.push(data.toString());
      session.lastActivity = new Date();
      if (session.outputBuffer.length > 1000) {
        session.outputBuffer = session.outputBuffer.slice(-500);
      }
    });

    childProc.stderr?.on("data", (data: Buffer) => {
      session.outputBuffer.push(data.toString());
      session.lastActivity = new Date();
    });

    childProc.on("close", () => {
      session.connected = false;
    });

    childProc.on("error", (err) => {
      session.outputBuffer.push(`Error: ${err.message}\n`);
      session.connected = false;
    });

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;

    // Wait for initial connection
    await this.sleep(3000);

    return session;
  }

  private async startSsh2Session(
    host: string,
    username: string,
    options: {
      port?: number;
      password?: string;
      privateKeyPath?: string;
      passphrase?: string;
    }
  ): Promise<ShellSession> {
    const sessionId = this.generateSessionId();
    const client = new Client();

    const connectConfig: ConnectConfig = {
      host,
      port: options.port || 22,
      username,
    };

    if (options.password) {
      connectConfig.password = options.password;
    } else if (options.privateKeyPath) {
      const keyPath = options.privateKeyPath.replace("~", homedir());
      if (existsSync(keyPath)) {
        connectConfig.privateKey = readFileSync(keyPath);
        if (options.passphrase) {
          connectConfig.passphrase = options.passphrase;
        }
      }
    } else {
      const defaultKeys = [
        join(homedir(), ".ssh", "id_ed25519"),
        join(homedir(), ".ssh", "id_rsa"),
        join(homedir(), ".ssh", "id_ecdsa"),
      ];
      for (const keyPath of defaultKeys) {
        if (existsSync(keyPath)) {
          connectConfig.privateKey = readFileSync(keyPath);
          break;
        }
      }
    }

    return new Promise((resolve, reject) => {
      const session: ShellSession = {
        id: sessionId,
        type: "ssh2",
        name: `${username}@${host}`,
        description: `SSH connection to ${host}`,
        originalCommand: `ssh ${username}@${host}`,
        connected: false,
        startedAt: new Date(),
        lastActivity: new Date(),
        outputBuffer: [],
        commandHistory: [],
        workingDirectory: "~",
        sshClient: client,
      };

      client.on("ready", async () => {
        session.connected = true;
        this.sessions.set(sessionId, session);
        this.activeSessionId = sessionId;

        try {
          const result = await this.execSsh2Command(session, "pwd");
          session.workingDirectory = result.trim();
        } catch (e) {}

        resolve(session);
      });

      client.on("error", (err) => reject(err));
      client.on("close", () => {
        session.connected = false;
      });

      client.connect(connectConfig);
    });
  }

  private async execSsh2Command(
    session: ShellSession,
    command: string,
    timeout: number = 30000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!session.sshClient) {
        reject(new Error("No SSH client"));
        return;
      }

      let output = "";
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      session.sshClient.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
          return;
        }

        stream.on("close", () => {
          clearTimeout(timeoutId);
          session.lastActivity = new Date();
          session.commandHistory.push({
            command,
            output,
            timestamp: new Date(),
          });
          if (session.commandHistory.length > 100) {
            session.commandHistory.shift();
          }
          resolve(output);
        });

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          output += data.toString();
        });
      });
    });
  }

  private async execChildProcessCommand(
    session: ShellSession,
    command: string,
    waitTime: number = 2000
  ): Promise<string> {
    if (!session.childProcess || !session.childProcess.stdin) {
      throw new Error("No child process session");
    }

    session.outputBuffer = [];
    session.childProcess.stdin.write(command + "\n");
    await this.sleep(waitTime);

    // Preserve raw terminal output - no stripping of ANSI codes
    const output = session.outputBuffer.join("");

    session.commandHistory.push({
      command,
      output: stripAnsi(output), // History uses clean output for searchability
      timestamp: new Date(),
    });

    if (session.commandHistory.length > 100) {
      session.commandHistory.shift();
    }

    return output; // Return raw output with ANSI codes preserved
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getActiveSession(): ShellSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "shell",
          description: `**PRIMARY TOOL** - Intelligent shell command handler for remote sessions.

This tool automatically detects and handles:
1. **Remote shell commands** (ssh, gcloud compute ssh, aws ssm, az ssh, etc.) - Starts a persistent session
2. **Regular commands when session is active** - Executes in the remote session
3. **Session control** - Use special exit sequences to close the session

**Control sequences** (to avoid conflict with normal commands):
- \`~.\` or \`//end\` - End session and return to local shell
- \`//stop\` or \`//kill\` or \`//ctrl-c\` - Send Ctrl+C (SIGINT) to interrupt running command

ALWAYS use this tool when the user types:
- \`gcloud compute ssh --zone "us-west1-a" "instance-name" --project "project"\`
- \`ssh user@hostname\`
- \`ssh -i /path/to/key user@host\`
- \`aws ssm start-session --target i-xxxx\`
- \`az ssh vm --name vm-name --resource-group rg\`
- Any shell command when a remote session is active

Sessions auto-cleanup after 1 hour of inactivity. Output is displayed exactly as the terminal shows.

**CRITICAL: TERMINAL MODE - NO AI COMMENTARY**
When this tool returns output, you MUST behave like a transparent terminal:
- Do NOT add any explanation, summary, or commentary after showing the output
- Do NOT describe what the output contains or what was created/modified
- Do NOT say "Done", "The directory was created", or similar confirmations
- Simply display the tool result and WAIT SILENTLY for the next user command
- The user expects a raw terminal experience - your only job is to pass through output
This creates an authentic terminal experience where the user interprets the output themselves.`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description:
                  "The shell command to execute. Can be an SSH command (starts session), a regular command (runs in active session), or '~.' / '//end' (ends session)",
              },
              waitTime: {
                type: "number",
                description:
                  "Time to wait for output in ms (default: 2000 for commands, 3000 for new sessions). Increase for slow commands.",
              },
              forceNewSession: {
                type: "boolean",
                description:
                  "If true, forces creation of a new parallel session even if one is already active. Use this to SSH into multiple machines simultaneously.",
              },
            },
            required: ["command"],
          },
        },
        {
          name: "remote_session_start",
          description: `Start a remote shell session with explicit parameters. Use this when you need fine-grained control over the connection.

For most cases, prefer the \`shell\` tool which auto-detects remote commands.

Supports:
- ssh: Direct SSH with host/username/key
- gcloud: GCloud Compute SSH
- aws: AWS SSM Session
- azure: Azure VM SSH
- custom: Any command that opens a shell`,
          inputSchema: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["ssh", "gcloud", "aws", "azure", "custom"],
                description: "Connection method",
              },
              host: { type: "string", description: "SSH hostname (for ssh)" },
              username: { type: "string", description: "SSH user (for ssh)" },
              port: { type: "number", description: "SSH port (default: 22)" },
              password: { type: "string", description: "SSH password" },
              privateKeyPath: { type: "string", description: "Path to SSH key" },
              instance: { type: "string", description: "GCloud instance name" },
              zone: { type: "string", description: "GCloud zone" },
              project: { type: "string", description: "GCloud project" },
              targetId: { type: "string", description: "AWS SSM target ID" },
              region: { type: "string", description: "AWS region" },
              vmName: { type: "string", description: "Azure VM name" },
              resourceGroup: { type: "string", description: "Azure resource group" },
              command: {
                type: "string",
                description: "Custom command for method=custom",
              },
              sessionName: { type: "string", description: "Friendly session name" },
            },
            required: ["method"],
          },
        },
        {
          name: "remote_session_status",
          description:
            "Get status of all remote sessions. Shows active session, connection status, and command counts.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "remote_session_switch",
          description: "Switch the active session when multiple sessions are open.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: { type: "string", description: "Session ID to switch to" },
            },
            required: ["sessionId"],
          },
        },
        {
          name: "remote_session_end",
          description:
            "End remote session(s) and return to local context. Use sessionId='all' to end all sessions.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "Session ID, 'all', or omit for active session",
              },
            },
          },
        },
        {
          name: "remote_session_history",
          description: "Get command history for the active or specified session.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: { type: "string", description: "Session ID (optional)" },
              limit: { type: "number", description: "Max entries (default: 20)" },
            },
          },
        },
        {
          name: "remote_session_output",
          description: "Read recent raw output from session buffer.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: { type: "string" },
              lines: { type: "number", description: "Lines to show (default: 50)" },
            },
          },
        },
        {
          name: "remote_session_signal",
          description: "Send a signal to the active session. Use this to send Ctrl+C (SIGINT) to interrupt a running command, or other signals.",
          inputSchema: {
            type: "object",
            properties: {
              signal: {
                type: "string",
                enum: ["SIGINT", "SIGTERM", "SIGKILL", "SIGHUP"],
                description: "Signal to send. SIGINT = Ctrl+C (interrupt), SIGTERM = terminate, SIGKILL = force kill",
              },
              sessionId: { type: "string", description: "Session ID (optional, defaults to active)" },
            },
            required: ["signal"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const params = (args || {}) as Record<string, any>;

      try {
        switch (name) {
          // ============================================
          // MAIN SMART SHELL COMMAND HANDLER
          // ============================================
          case "shell": {
            const { command, waitTime, forceNewSession } = params;
            const trimmedCommand = command.trim();

            // Check for exit/end session commands using special sequences
            if (isSessionExitCommand(trimmedCommand)) {
              const session = this.getActiveSession();
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

              // End the session
              if (session.childProcess) {
                session.childProcess.stdin?.write("exit\n");
                await this.sleep(500);
                session.childProcess.kill();
              }
              if (session.sshClient) {
                session.sshClient.end();
              }

              const sessionName = session.name;
              this.sessions.delete(session.id);

              const remaining = Array.from(this.sessions.keys());
              this.activeSessionId = remaining.length > 0 ? remaining[0] : null;

              return {
                content: [
                  {
                    type: "text",
                    text: `${COLORS.bold}${COLORS.green}Session ended: ${sessionName}${COLORS.reset}

${this.activeSessionId ? `${COLORS.cyan}Switched to: ${this.sessions.get(this.activeSessionId)?.name}${COLORS.reset}` : `${COLORS.gray}You are now back in the local shell.${COLORS.reset}`}`,
                  },
                ],
              };
            }

            // Check for interrupt commands (Ctrl+C equivalent)
            if (isSessionInterruptCommand(trimmedCommand)) {
              const session = this.getActiveSession();
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

              if (session.childProcess) {
                // Send Ctrl+C character
                session.childProcess.stdin?.write("\x03");
                // Also send SIGINT
                session.childProcess.kill("SIGINT");
                session.lastActivity = new Date();

                await this.sleep(500);
                const recentOutput = session.outputBuffer.slice(-5).join("");

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

              return {
                content: [
                  {
                    type: "text",
                    text: `${COLORS.yellow}Cannot send interrupt to this session type.${COLORS.reset}`,
                  },
                ],
              };
            }

            // Check if we have an active session - if so, execute command in it
            // (including nested ssh commands - they should run inside the existing session)
            // UNLESS forceNewSession is true AND this is a remote shell command
            const session = this.getActiveSession();
            const shouldForceNew = forceNewSession && isRemoteShellCommand(trimmedCommand);
            if (session && !shouldForceNew) {
              // Execute command in active session
              if (!session.connected) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `**Session disconnected: ${session.name}**

The remote session has been disconnected. Start a new session to continue.`,
                    },
                  ],
                };
              }

              let output: string;
              if (session.type === "ssh2") {
                output = await this.execSsh2Command(
                  session,
                  trimmedCommand,
                  waitTime || 30000
                );
              } else {
                output = await this.execChildProcessCommand(
                  session,
                  trimmedCommand,
                  waitTime || 2000
                );
              }

              return {
                content: [
                  {
                    type: "text",
                    text: `${formatPrompt(session.name, command)}
${formatOutputStart()}
${output}
${formatOutputEnd()}`,
                  },
                ],
              };
            }

            // No active session - check if this is a remote shell command to start one
            if (isRemoteShellCommand(trimmedCommand)) {
              // Start a new session
              const sessionName = extractSessionName(trimmedCommand);
              const parts = trimmedCommand.split(/\s+/);
              const executable = parts[0];
              const cmdArgs = parts.slice(1);

              const newSession = await this.startChildProcessSession(
                executable,
                cmdArgs,
                sessionName,
                `Remote session: ${trimmedCommand}`,
                trimmedCommand
              );

              // Preserve raw terminal output
              const initialOutput = newSession.outputBuffer.join("").slice(-2000);

              return {
                content: [
                  {
                    type: "text",
                    text: `${COLORS.bold}${COLORS.green}Remote session started: ${newSession.name}${COLORS.reset}

${COLORS.cyan}Session ID:${COLORS.reset} ${newSession.id}
${COLORS.cyan}Command:${COLORS.reset} ${trimmedCommand}

${formatOutputStart()}
${initialOutput || `${COLORS.yellow}(connecting...)${COLORS.reset}`}
${formatOutputEnd()}

${COLORS.gray}You are now in a remote shell. Commands will execute remotely.${COLORS.reset}
${COLORS.yellow}To exit: type ${COLORS.bold}~.${COLORS.reset}${COLORS.yellow} or ${COLORS.bold}//end${COLORS.reset}`,
                  },
                ],
              };
            }

            // No active session and not a remote command
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

          // ============================================
          // EXPLICIT SESSION START
          // ============================================
          case "remote_session_start": {
            const { method } = params;
            let session: ShellSession;

            switch (method) {
              case "ssh": {
                const { host, username, port, password, privateKeyPath } = params;
                if (!host || !username) {
                  throw new Error("host and username required for SSH");
                }
                session = await this.startSsh2Session(host, username, {
                  port,
                  password,
                  privateKeyPath,
                });
                break;
              }

              case "gcloud": {
                const { instance, zone, project, sessionName } = params;
                if (!instance) throw new Error("instance required for gcloud");

                const gcloudArgs = ["compute", "ssh", instance];
                if (zone) gcloudArgs.push(`--zone=${zone}`);
                if (project) gcloudArgs.push(`--project=${project}`);

                const cmd = `gcloud ${gcloudArgs.join(" ")}`;
                session = await this.startChildProcessSession(
                  "gcloud",
                  gcloudArgs,
                  sessionName || `gcloud:${instance}`,
                  `GCloud SSH to ${instance}`,
                  cmd
                );
                break;
              }

              case "aws": {
                const { targetId, region, sessionName } = params;
                if (!targetId) throw new Error("targetId required for AWS");

                const awsArgs = ["ssm", "start-session", "--target", targetId];
                if (region) awsArgs.push("--region", region);

                const cmd = `aws ${awsArgs.join(" ")}`;
                session = await this.startChildProcessSession(
                  "aws",
                  awsArgs,
                  sessionName || `aws:${targetId}`,
                  `AWS SSM to ${targetId}`,
                  cmd
                );
                break;
              }

              case "azure": {
                const { vmName, resourceGroup, sessionName } = params;
                if (!vmName || !resourceGroup) {
                  throw new Error("vmName and resourceGroup required for Azure");
                }

                const azArgs = ["ssh", "vm", "--name", vmName, "-g", resourceGroup];
                const cmd = `az ${azArgs.join(" ")}`;
                session = await this.startChildProcessSession(
                  "az",
                  azArgs,
                  sessionName || `azure:${vmName}`,
                  `Azure SSH to ${vmName}`,
                  cmd
                );
                break;
              }

              case "custom": {
                const { command, sessionName } = params;
                if (!command) throw new Error("command required for custom");

                const parts = command.split(/\s+/);
                session = await this.startChildProcessSession(
                  parts[0],
                  parts.slice(1),
                  sessionName || extractSessionName(command),
                  `Custom: ${command}`,
                  command
                );
                break;
              }

              default:
                throw new Error(`Unknown method: ${method}`);
            }

            const initialOutput = stripAnsi(session.outputBuffer.join("")).slice(
              -1500
            );

            return {
              content: [
                {
                  type: "text",
                  text: `**Remote session started: ${session.name}**

Session ID: ${session.id}
Type: ${session.type}
Status: ${session.connected ? "Connected" : "Connecting..."}

---
${initialOutput || "(connecting...)"}
---

Use \`shell\` tool to run commands. Type \`exit\` to end session.`,
                },
              ],
            };
          }

          // ============================================
          // SESSION STATUS
          // ============================================
          case "remote_session_status": {
            const sessionList = Array.from(this.sessions.values());

            if (sessionList.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: `**No remote sessions**

Start a session by running an SSH command through the \`shell\` tool.`,
                  },
                ],
              };
            }

            const statusLines = sessionList.map((s) => {
              const active = this.activeSessionId === s.id ? " **[ACTIVE]**" : "";
              const status = s.connected ? "Connected" : "Disconnected";
              return `- **${s.name}** (${s.id})${active}
  Status: ${status} | Commands: ${s.commandHistory.length} | Started: ${s.startedAt.toLocaleTimeString()}
  Original: \`${s.originalCommand}\``;
            });

            return {
              content: [
                {
                  type: "text",
                  text: `**Remote Sessions (${sessionList.length})**

${statusLines.join("\n\n")}`,
                },
              ],
            };
          }

          // ============================================
          // SESSION SWITCH
          // ============================================
          case "remote_session_switch": {
            const { sessionId } = params;
            const session = this.sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            this.activeSessionId = sessionId;

            return {
              content: [
                {
                  type: "text",
                  text: `**Switched to: ${session.name}**

Commands will now execute in this session.`,
                },
              ],
            };
          }

          // ============================================
          // SESSION END
          // ============================================
          case "remote_session_end": {
            let { sessionId } = params;

            if (sessionId === "all") {
              const count = this.sessions.size;
              for (const s of this.sessions.values()) {
                if (s.childProcess) s.childProcess.kill();
                if (s.sshClient) s.sshClient.end();
              }
              this.sessions.clear();
              this.activeSessionId = null;

              return {
                content: [
                  {
                    type: "text",
                    text: `**Ended ${count} session(s)**

You are now in the local shell.`,
                  },
                ],
              };
            }

            if (!sessionId) sessionId = this.activeSessionId;
            if (!sessionId) {
              return {
                content: [{ type: "text", text: "No active session to end." }],
              };
            }

            const session = this.sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            if (session.childProcess) {
              session.childProcess.stdin?.write("exit\n");
              await this.sleep(500);
              session.childProcess.kill();
            }
            if (session.sshClient) session.sshClient.end();

            const name = session.name;
            this.sessions.delete(sessionId);

            if (this.activeSessionId === sessionId) {
              const remaining = Array.from(this.sessions.keys());
              this.activeSessionId = remaining[0] || null;
            }

            return {
              content: [
                {
                  type: "text",
                  text: `**Ended session: ${name}**

${this.activeSessionId ? `Active session: ${this.sessions.get(this.activeSessionId)?.name}` : "You are now in the local shell."}`,
                },
              ],
            };
          }

          // ============================================
          // SESSION HISTORY
          // ============================================
          case "remote_session_history": {
            const { sessionId, limit } = params;
            const session = sessionId
              ? this.sessions.get(sessionId)
              : this.getActiveSession();

            if (!session) throw new Error("No session found");

            const history = session.commandHistory.slice(-(limit || 20));
            const historyText = history
              .map(
                (h, i) =>
                  `${i + 1}. \`${h.command}\` (${h.timestamp.toLocaleTimeString()})`
              )
              .join("\n");

            return {
              content: [
                {
                  type: "text",
                  text: `**History for ${session.name}** (${history.length} commands)

${historyText || "No commands yet."}`,
                },
              ],
            };
          }

          // ============================================
          // SESSION OUTPUT
          // ============================================
          case "remote_session_output": {
            const { sessionId, lines } = params;
            const session = sessionId
              ? this.sessions.get(sessionId)
              : this.getActiveSession();

            if (!session) throw new Error("No session found");

            // Preserve raw output for display
            const output = session.outputBuffer.join("")
              .split("\n")
              .slice(-(lines || 50))
              .join("\n");

            return {
              content: [
                {
                  type: "text",
                  text: `${COLORS.bold}${COLORS.cyan}Output from ${session.name}${COLORS.reset}
${formatOutputStart()}
${output}
${formatOutputEnd()}`,
                },
              ],
            };
          }

          // ============================================
          // SESSION SIGNAL (Ctrl+C, etc.)
          // ============================================
          case "remote_session_signal": {
            const { signal, sessionId } = params;
            const session = sessionId
              ? this.sessions.get(sessionId)
              : this.getActiveSession();

            if (!session) throw new Error("No session found");

            if (session.type === "child_process" && session.childProcess) {
              const signalMap: Record<string, NodeJS.Signals> = {
                "SIGINT": "SIGINT",
                "SIGTERM": "SIGTERM",
                "SIGKILL": "SIGKILL",
                "SIGHUP": "SIGHUP",
              };

              const nodeSignal = signalMap[signal];
              if (!nodeSignal) {
                throw new Error(`Unknown signal: ${signal}`);
              }

              // For SIGINT (Ctrl+C), write the interrupt character
              if (signal === "SIGINT" && session.childProcess.stdin) {
                session.childProcess.stdin.write("\x03"); // Ctrl+C
              }

              // Also send the actual signal to the process
              session.childProcess.kill(nodeSignal);
              session.lastActivity = new Date();

              // Wait a moment and collect any output
              await this.sleep(500);
              const recentOutput = session.outputBuffer.slice(-5).join("");

              return {
                content: [
                  {
                    type: "text",
                    text: `${COLORS.yellow}Sent ${signal} to session ${session.name}${COLORS.reset}

${recentOutput ? `${formatOutputStart()}\n${recentOutput}\n${formatOutputEnd()}` : ""}`,
                  },
                ],
              };
            } else if (session.type === "ssh2") {
              // For SSH2 sessions, we can't easily send signals
              // But we can try sending Ctrl+C character
              return {
                content: [
                  {
                    type: "text",
                    text: `${COLORS.yellow}Signal handling not fully supported for SSH2 sessions.${COLORS.reset}
Try running a new command or use //end to close the session.`,
                  },
                ],
              };
            }

            throw new Error("Session type not supported for signals");
          }

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

  private setupPromptHandlers() {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "end-session",
            description: "End the current remote shell session or all sessions",
            arguments: [
              {
                name: "sessionId",
                description: "Session ID to end, or 'all' to end all sessions. Defaults to active session.",
                required: false,
              },
            ],
          },
          {
            name: "stop",
            description: "Send Ctrl+C (SIGINT) to interrupt the current command in the active session",
          },
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
            description: "Exit a nested shell (inner SSH, sudo, docker exec, etc.) without killing the main session. Sends 'exit' to step back one level.",
          },
          {
            name: "new-session",
            description: "Start a new parallel SSH session without running inside the current active session. Use this to connect to multiple machines simultaneously.",
            arguments: [
              {
                name: "command",
                description: "The SSH/remote command to run (e.g., 'gcloud compute ssh ...', 'ssh user@host')",
                required: true,
              },
            ],
          },
        ],
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "end-session": {
          const sessionId = args?.sessionId || this.activeSessionId || "";
          const session = sessionId === "all" ? null : this.sessions.get(sessionId);

          if (sessionId === "all") {
            const count = this.sessions.size;
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

          if (!session && !this.activeSessionId) {
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

          const targetSession = session || this.sessions.get(this.activeSessionId!);
          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `End the remote session "${targetSession?.name}" (${targetSession?.id}). Use the remote_session_end tool to confirm.`,
                },
              },
            ],
          };
        }

        case "stop": {
          const activeSession = this.getActiveSession();
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
                  text: `Send Ctrl+C (SIGINT) to interrupt the current command in session "${activeSession.name}". Use the remote_session_signal tool with signal="SIGINT" to confirm.`,
                },
              },
            ],
          };
        }

        case "session-status": {
          const sessionList = Array.from(this.sessions.values());

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

          const statusLines = sessionList.map((s) => {
            const active = this.activeSessionId === s.id ? " [ACTIVE]" : "";
            const status = s.connected ? "Connected" : "Disconnected";
            return `- ${s.name} (${s.id})${active}\n  Status: ${status} | Commands: ${s.commandHistory.length} | Started: ${s.startedAt.toLocaleTimeString()}\n  Original: ${s.originalCommand}`;
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

        case "switch-session": {
          const sessionId = args?.sessionId;
          if (!sessionId) {
            const sessionList = Array.from(this.sessions.values());
            const options = sessionList.map(s => `- ${s.id}: ${s.name}`).join("\n");
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

          const session = this.sessions.get(sessionId);
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

        case "session-history": {
          const sessionId = args?.sessionId;
          const limit = args?.limit ? parseInt(args.limit, 10) : 20;
          const session = sessionId
            ? this.sessions.get(sessionId)
            : this.getActiveSession();

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

        case "exit-nested": {
          const activeSession = this.getActiveSession();
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
                  text: `Exit the innermost nested shell in session "${activeSession.name}" (${activeSession.id}).

This is for stepping back from nested shells like:
- Inner SSH sessions (SSH from one server to another)
- sudo/su shells
- docker exec / kubectl exec sessions
- nix-shell, poetry shell, etc.

Use the shell tool with command="exit" to send the exit command. This will exit one level without killing the entire session.

If you want to completely end the session instead, use the remote_session_end tool.`,
                },
              },
            ],
          };
        }

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

          const currentSession = this.getActiveSession();
          const currentInfo = currentSession
            ? `Current active session: "${currentSession.name}" (${currentSession.id}) - this will remain available.`
            : "No current active session.";

          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Start a NEW parallel remote session with command: ${command}

${currentInfo}

Use the shell tool with:
- command="${command}"
- forceNewSession=true

This will create a new session that runs alongside any existing sessions. You can switch between sessions using the remote_session_switch tool.`,
                },
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Remote Shell MCP server v2.3 running on stdio");
  }
}

const server = new RemoteShellServer();
server.run().catch(console.error);
