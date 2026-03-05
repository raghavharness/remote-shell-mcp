import { ShellSession, ConnectionEvent } from "../types.js";
import { spawn } from "child_process";
import { Client, ConnectConfig } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { EventEmitter } from "events";

export interface ReconnectOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RECONNECT_OPTIONS: ReconnectOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export class ReconnectManager extends EventEmitter {
  private reconnecting: Map<string, boolean> = new Map();
  private options: ReconnectOptions;

  constructor(options: Partial<ReconnectOptions> = {}) {
    super();
    this.options = { ...DEFAULT_RECONNECT_OPTIONS, ...options };
  }

  /**
   * Check if a session is disconnected
   */
  isDisconnected(session: ShellSession): boolean {
    if (session.type === "child_process" && session.childProcess) {
      return session.childProcess.exitCode !== null || session.childProcess.killed;
    }

    if (session.type === "ssh2" && session.sshClient) {
      // SSH2 doesn't have a direct "connected" property
      // We rely on the session.connected flag
      return !session.connected;
    }

    return !session.connected;
  }

  /**
   * Attempt to reconnect a session
   */
  async reconnect(session: ShellSession): Promise<boolean> {
    if (this.reconnecting.get(session.id)) {
      return false; // Already reconnecting
    }

    if (!session.autoReconnect) {
      return false;
    }

    this.reconnecting.set(session.id, true);
    this.emit("reconnecting", { sessionId: session.id, timestamp: new Date() } as ConnectionEvent);

    let attempt = 0;
    let delay = this.options.initialDelay;

    while (attempt < session.maxReconnectAttempts) {
      attempt++;
      session.reconnectAttempts = attempt;

      console.error(`[remote-shell] Reconnect attempt ${attempt}/${session.maxReconnectAttempts} for ${session.name}`);

      try {
        const success = await this.attemptReconnect(session);

        if (success) {
          session.connected = true;
          session.reconnectAttempts = 0;
          this.reconnecting.delete(session.id);

          this.emit("connected", {
            sessionId: session.id,
            timestamp: new Date(),
          } as ConnectionEvent);

          return true;
        }
      } catch (error) {
        console.error(`[remote-shell] Reconnect attempt ${attempt} failed:`, error);
      }

      // Wait before next attempt
      await this.sleep(delay);
      delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
    }

    this.reconnecting.delete(session.id);

    this.emit("failed", {
      sessionId: session.id,
      timestamp: new Date(),
      error: new Error(`Failed to reconnect after ${attempt} attempts`),
    } as ConnectionEvent);

    return false;
  }

  /**
   * Attempt a single reconnection
   */
  private async attemptReconnect(session: ShellSession): Promise<boolean> {
    if (session.type === "child_process") {
      return this.reconnectChildProcess(session);
    }

    if (session.type === "ssh2") {
      return this.reconnectSsh2(session);
    }

    return false;
  }

  /**
   * Reconnect a child process session
   */
  private async reconnectChildProcess(session: ShellSession): Promise<boolean> {
    // Kill existing process if any
    if (session.childProcess) {
      try {
        session.childProcess.kill();
      } catch {}
    }

    // Re-spawn using original command
    const childProc = spawn(session.originalCommand, [], {
      cwd: homedir(),
      env: { ...process.env, TERM: "xterm-256color" },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    // Set up event handlers
    childProc.stdout?.on("data", (data: Buffer) => {
      session.outputBuffer.push(data.toString());
      session.lastActivity = new Date();
      if (session.outputBuffer.length > 1000) {
        session.outputBuffer = session.outputBuffer.slice(-500);
      }

      // Notify listeners
      for (const listener of session.outputListeners) {
        listener(data.toString());
      }
    });

    childProc.stderr?.on("data", (data: Buffer) => {
      session.outputBuffer.push(data.toString());
      session.lastActivity = new Date();

      // Notify listeners
      for (const listener of session.outputListeners) {
        listener(data.toString());
      }
    });

    childProc.on("close", () => {
      session.connected = false;
      this.emit("disconnected", {
        sessionId: session.id,
        timestamp: new Date(),
      } as ConnectionEvent);
    });

    childProc.on("error", (err) => {
      session.outputBuffer.push(`Error: ${err.message}\n`);
      session.connected = false;
    });

    session.childProcess = childProc;

    // Wait for connection
    await this.sleep(3000);

    // Check if connected
    if (childProc.exitCode === null && !childProc.killed) {
      session.connected = true;
      return true;
    }

    return false;
  }

  /**
   * Reconnect an SSH2 session
   */
  private async reconnectSsh2(session: ShellSession): Promise<boolean> {
    // Close existing client
    if (session.sshClient) {
      try {
        session.sshClient.end();
      } catch {}
    }

    // Parse connection details from original command or session name
    const connectionInfo = this.parseConnectionInfo(session);
    if (!connectionInfo) {
      return false;
    }

    const client = new Client();

    return new Promise((resolve) => {
      const connectConfig: ConnectConfig = {
        host: connectionInfo.host,
        port: connectionInfo.port || 22,
        username: connectionInfo.username,
      };

      // Try to find SSH key
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

      client.on("ready", () => {
        session.sshClient = client;
        session.connected = true;
        resolve(true);
      });

      client.on("error", () => {
        resolve(false);
      });

      client.on("close", () => {
        session.connected = false;
        this.emit("disconnected", {
          sessionId: session.id,
          timestamp: new Date(),
        } as ConnectionEvent);
      });

      try {
        client.connect(connectConfig);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Parse connection info from session
   */
  private parseConnectionInfo(session: ShellSession): { host: string; port?: number; username: string } | null {
    // Try session name format: ssh:user@host
    const sshNameMatch = session.name.match(/ssh:(\S+)@(\S+)/);
    if (sshNameMatch) {
      return {
        username: sshNameMatch[1],
        host: sshNameMatch[2],
      };
    }

    // Try original command
    const cmdMatch = session.originalCommand.match(/ssh\s+(?:-p\s+(\d+)\s+)?(?:-[^\s]+\s+)*(?:(\S+)@)?(\S+)/);
    if (cmdMatch) {
      return {
        port: cmdMatch[1] ? parseInt(cmdMatch[1]) : 22,
        username: cmdMatch[2] || process.env.USER || "root",
        host: cmdMatch[3],
      };
    }

    return null;
  }

  /**
   * Monitor a session for disconnection
   */
  startMonitoring(session: ShellSession, checkInterval: number = 5000): () => void {
    const interval = setInterval(async () => {
      if (this.isDisconnected(session) && session.autoReconnect) {
        console.error(`[remote-shell] Session ${session.name} disconnected, attempting reconnect...`);
        await this.reconnect(session);
      }
    }, checkInterval);

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Stop reconnection attempts for a session
   */
  stopReconnect(sessionId: string): void {
    this.reconnecting.delete(sessionId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const reconnectManager = new ReconnectManager();
