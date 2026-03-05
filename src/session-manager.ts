import { ShellSession, SessionStartOptions, CommandHistoryEntry } from "./types.js";
import { spawn, ChildProcess } from "child_process";
import { Client, ConnectConfig } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { extractSessionName } from "./utils/patterns.js";
import { stripAnsi, COLORS } from "./utils/ansi.js";
import { smartWait } from "./features/smart-wait.js";
import { directoryTracker } from "./features/directory-tracker.js";
import { reconnectManager } from "./features/reconnect.js";
import { portForwarder } from "./features/port-forward.js";
import { collectOutput } from "./features/streaming.js";

// Stale session timeout (1 hour in milliseconds)
const STALE_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export class SessionManager {
  private sessions: Map<string, ShellSession> = new Map();
  private activeSessionId: string | null = null;
  private sessionCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private monitoringCleanups: Map<string, () => void> = new Map();

  constructor() {
    this.startStaleSessionCleanup();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${++this.sessionCounter}`;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ShellSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get a specific session
   */
  getSession(sessionId: string): ShellSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get the active session
   */
  getActiveSession(): ShellSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Set the active session
   */
  setActiveSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      return true;
    }
    return false;
  }

  /**
   * Start a child process session
   */
  async startChildProcessSession(
    command: string,
    args: string[],
    name: string,
    description: string,
    originalCommand: string,
    options: { autoReconnect?: boolean } = {}
  ): Promise<ShellSession> {
    const sessionId = this.generateSessionId();

    // Modify SSH commands to force TTY allocation
    let modifiedCommand = originalCommand;
    let modifiedArgs = [...args];

    if (command === "ssh") {
      const sshOptions: string[] = [];

      if (!args.includes("-t") && !args.includes("-tt")) {
        sshOptions.push("-tt");
      }

      if (!args.some(arg => arg.includes("StrictHostKeyChecking"))) {
        sshOptions.push("-o", "StrictHostKeyChecking=accept-new");
      }

      if (sshOptions.length > 0) {
        modifiedArgs = [...sshOptions, ...args];
        modifiedCommand = `ssh ${sshOptions.join(" ")} ${args.join(" ")}`;
      }
    } else if (command === "gcloud" && originalCommand.includes("compute ssh")) {
      if (!originalCommand.includes("-- ")) {
        const sshFlags = "-t -t -o StrictHostKeyChecking=accept-new";
        modifiedArgs = [...args, "--", ...sshFlags.split(" ")];
        modifiedCommand = `${originalCommand} -- ${sshFlags}`;
      }
    }

    const childProc = spawn(modifiedCommand, [], {
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
      connected: false, // Will be set to true after connection verification
      startedAt: new Date(),
      lastActivity: new Date(),
      outputBuffer: [],
      commandHistory: [],
      workingDirectory: "~",
      childProcess: childProc,
      portForwards: [],
      reconnectAttempts: 0,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      autoReconnect: options.autoReconnect ?? true,
      outputListeners: new Set(),
      pendingOutput: "",
    };

    // Initialize directory tracking
    directoryTracker.initSession(sessionId, "~");

    childProc.stdout?.on("data", (data: Buffer) => {
      const dataStr = data.toString();
      session.outputBuffer.push(dataStr);
      session.lastActivity = new Date();

      if (session.outputBuffer.length > 1000) {
        session.outputBuffer = session.outputBuffer.slice(-500);
      }

      // Notify streaming listeners
      for (const listener of session.outputListeners) {
        try {
          listener(dataStr);
        } catch {}
      }
    });

    childProc.stderr?.on("data", (data: Buffer) => {
      const dataStr = data.toString();
      session.outputBuffer.push(dataStr);
      session.lastActivity = new Date();

      // Notify streaming listeners
      for (const listener of session.outputListeners) {
        try {
          listener(dataStr);
        } catch {}
      }
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

    // Wait for initial connection with verification
    const connectionVerified = await this.waitForConnection(session, 15000);
    session.connected = connectionVerified;

    if (!connectionVerified) {
      console.error(`[remote-shell] Connection may not be fully established for ${name}`);
    }

    // Start connection monitoring if auto-reconnect enabled
    if (session.autoReconnect) {
      const cleanup = reconnectManager.startMonitoring(session);
      this.monitoringCleanups.set(sessionId, cleanup);
    }

    // Try to get initial working directory
    await this.updateWorkingDirectory(session);

    return session;
  }

  /**
   * Start an SSH2 session
   */
  async startSsh2Session(
    host: string,
    username: string,
    options: {
      port?: number;
      password?: string;
      privateKeyPath?: string;
      passphrase?: string;
      autoReconnect?: boolean;
    } = {}
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
        portForwards: [],
        reconnectAttempts: 0,
        maxReconnectAttempts: 3,
        reconnectDelay: 1000,
        autoReconnect: options.autoReconnect ?? true,
        outputListeners: new Set(),
        pendingOutput: "",
      };

      // Initialize directory tracking
      directoryTracker.initSession(sessionId, "~");

      client.on("ready", async () => {
        session.connected = true;
        this.sessions.set(sessionId, session);
        this.activeSessionId = sessionId;

        // Start connection monitoring if auto-reconnect enabled
        if (session.autoReconnect) {
          const cleanup = reconnectManager.startMonitoring(session);
          this.monitoringCleanups.set(sessionId, cleanup);
        }

        try {
          const result = await this.execSsh2Command(session, "pwd", 5000);
          session.workingDirectory = result.trim();
          directoryTracker.updateFromPwd(sessionId, result);
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

  /**
   * Execute a command in an SSH2 session
   */
  async execSsh2Command(
    session: ShellSession,
    command: string,
    timeout?: number
  ): Promise<string> {
    const waitTime = timeout ?? smartWait.getWaitTime(command);

    return new Promise((resolve, reject) => {
      if (!session.sshClient) {
        reject(new Error("No SSH client"));
        return;
      }

      let output = "";
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timed out after ${waitTime}ms`));
      }, waitTime);

      session.sshClient.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
          return;
        }

        stream.on("close", () => {
          clearTimeout(timeoutId);
          session.lastActivity = new Date();

          const historyEntry: CommandHistoryEntry = {
            command,
            output: stripAnsi(output),
            timestamp: new Date(),
            workingDirectory: session.workingDirectory,
          };

          session.commandHistory.push(historyEntry);

          if (session.commandHistory.length > 100) {
            session.commandHistory.shift();
          }

          // Update directory tracking
          directoryTracker.updateFromCommand(session, command, output);

          resolve(output);
        });

        stream.on("data", (data: Buffer) => {
          const dataStr = data.toString();
          output += dataStr;

          // Notify streaming listeners
          for (const listener of session.outputListeners) {
            try {
              listener(dataStr);
            } catch {}
          }
        });

        stream.stderr.on("data", (data: Buffer) => {
          const dataStr = data.toString();
          output += dataStr;

          // Notify streaming listeners
          for (const listener of session.outputListeners) {
            try {
              listener(dataStr);
            } catch {}
          }
        });
      });
    });
  }

  /**
   * Execute a command in a child process session
   */
  async execChildProcessCommand(
    session: ShellSession,
    command: string,
    waitTime?: number
  ): Promise<string> {
    if (!session.childProcess || !session.childProcess.stdin) {
      throw new Error("No child process session");
    }

    // Verify process is still running
    if (session.childProcess.exitCode !== null || session.childProcess.killed) {
      session.connected = false;
      throw new Error("Child process has exited");
    }

    const actualWaitTime = waitTime ?? smartWait.getWaitTime(command);

    session.outputBuffer = [];
    session.childProcess.stdin.write(command + "\n");

    // Use streaming if listeners are attached, otherwise wait
    const output = await collectOutput(session, actualWaitTime);

    // Preserve raw terminal output
    const fullOutput = output || session.outputBuffer.join("");

    const historyEntry: CommandHistoryEntry = {
      command,
      output: stripAnsi(fullOutput),
      timestamp: new Date(),
      workingDirectory: session.workingDirectory,
    };

    session.commandHistory.push(historyEntry);

    if (session.commandHistory.length > 100) {
      session.commandHistory.shift();
    }

    // Update directory tracking
    directoryTracker.updateFromCommand(session, command, fullOutput);

    return fullOutput;
  }

  /**
   * Send interrupt signal to session
   */
  async sendInterrupt(session: ShellSession): Promise<string> {
    if (session.type === "child_process" && session.childProcess) {
      session.childProcess.stdin?.write("\x03");
      session.childProcess.kill("SIGINT");
      session.lastActivity = new Date();

      await this.sleep(500);
      return session.outputBuffer.slice(-5).join("");
    }

    return "";
  }

  /**
   * Send a signal to session
   */
  async sendSignal(session: ShellSession, signal: NodeJS.Signals): Promise<boolean> {
    if (session.type === "child_process" && session.childProcess) {
      if (signal === "SIGINT") {
        session.childProcess.stdin?.write("\x03");
      }
      session.childProcess.kill(signal);
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Stop port forwards
    await portForwarder.stopAllForwards(session);

    // Stop monitoring
    const cleanupMonitoring = this.monitoringCleanups.get(sessionId);
    if (cleanupMonitoring) {
      cleanupMonitoring();
      this.monitoringCleanups.delete(sessionId);
    }

    // Stop reconnection attempts
    reconnectManager.stopReconnect(sessionId);

    // Clean up directory tracking
    directoryTracker.removeSession(sessionId);

    // Clear output listeners
    session.outputListeners.clear();

    // Terminate the session
    if (session.childProcess) {
      session.childProcess.stdin?.write("exit\n");
      await this.sleep(500);
      session.childProcess.kill();
    }

    if (session.sshClient) {
      session.sshClient.end();
    }

    this.sessions.delete(sessionId);

    // Update active session
    if (this.activeSessionId === sessionId) {
      const remaining = Array.from(this.sessions.keys());
      this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
    }

    return true;
  }

  /**
   * End all sessions
   */
  async endAllSessions(): Promise<number> {
    const count = this.sessions.size;
    const sessionIds = Array.from(this.sessions.keys());

    for (const sessionId of sessionIds) {
      await this.endSession(sessionId);
    }

    return count;
  }

  /**
   * Update working directory by running pwd
   */
  private async updateWorkingDirectory(session: ShellSession): Promise<void> {
    try {
      if (session.type === "child_process" && session.childProcess?.stdin) {
        session.outputBuffer = [];
        session.childProcess.stdin.write("pwd\n");
        await this.sleep(1000);
        const output = stripAnsi(session.outputBuffer.join("")).trim();
        const lines = output.split("\n");
        for (const line of lines) {
          if (line.startsWith("/") || line.startsWith("~")) {
            session.workingDirectory = line.trim();
            directoryTracker.updateFromPwd(session.id, line);
            break;
          }
        }
      }
    } catch {}
  }

  /**
   * Cleanup stale sessions
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const staleSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const lastActivityTime = session.lastActivity.getTime();
      const idleTime = now - lastActivityTime;

      if (idleTime >= STALE_SESSION_TIMEOUT_MS) {
        staleSessionIds.push(sessionId);
        console.error(
          `[remote-shell] Cleaning up stale session: ${session.name} (idle for ${Math.round(idleTime / 60000)} minutes)`
        );
      }
    }

    for (const sessionId of staleSessionIds) {
      this.endSession(sessionId);
    }
  }

  /**
   * Start periodic cleanup of stale sessions
   */
  private startStaleSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Wait for connection to be established by detecting shell prompt or output
   */
  private async waitForConnection(session: ShellSession, timeoutMs: number = 15000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 500;

    // Patterns that indicate a successful SSH connection (shell is ready)
    const connectionPatterns = [
      /\$\s*$/m,           // Shell prompt ending with $
      /#\s*$/m,            // Shell prompt ending with # (root)
      /Last login:/i,       // SSH login message
      /Welcome to/i,        // Welcome message
      /\w+@[\w.-]+:\S*\s*\$/m,  // user@hostname:path$ pattern (common prompt)
      /\w+@[\w-]+\s*[\$#]\s*$/m,  // user@hostname with prompt at end
    ];

    // Patterns that indicate connection FAILURE
    const failurePatterns = [
      /ERROR:/i,
      /Connection refused/i,
      /Connection timed out/i,
      /Permission denied/i,
      /Could not resolve hostname/i,
      /No route to host/i,
      /Network is unreachable/i,
      /Request is prohibited/i,  // GCP VPC service controls
    ];

    while (Date.now() - startTime < timeoutMs) {
      // Check if process is still running
      if (session.childProcess?.exitCode !== null || session.childProcess?.killed) {
        return false;
      }

      // Check output buffer for connection indicators
      const output = session.outputBuffer.join("");

      // Check for failure patterns first
      for (const pattern of failurePatterns) {
        if (pattern.test(output)) {
          return false;
        }
      }

      // Check for success patterns
      for (const pattern of connectionPatterns) {
        if (pattern.test(output)) {
          return true;
        }
      }

      await this.sleep(pollInterval);
    }

    // If the process is still running after timeout, consider it connected
    // This handles cases where the connection is established but no recognizable
    // prompt pattern was detected (common with gcloud SSH)
    if (session.childProcess?.exitCode === null && !session.childProcess?.killed) {
      // Process is still alive, assume connected
      return true;
    }

    // If we got any output at all, consider it connected (best effort)
    if (session.outputBuffer.length > 0) {
      const output = session.outputBuffer.join("");
      // Check if there's meaningful output (not just empty lines)
      if (output.trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
