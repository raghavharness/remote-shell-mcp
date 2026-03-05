import { ShellSession, PortForward, PortForwardOptions } from "../types.js";
import { Client } from "ssh2";
import { createServer, Server, Socket } from "net";
import { spawn, ChildProcess } from "child_process";

interface ActiveForward {
  portForward: PortForward;
  server?: Server;
  process?: ChildProcess;
  connections: Set<Socket>;
}

export class PortForwarder {
  private activeForwards: Map<string, ActiveForward> = new Map();
  private forwardCounter = 0;

  /**
   * Start a local port forward (local -> remote)
   * Listens on local port, forwards to remote host:port
   */
  async startLocalForward(
    session: ShellSession,
    options: PortForwardOptions
  ): Promise<PortForward> {
    const { localPort, remoteHost = "localhost", remotePort } = options;

    if (!remotePort) {
      throw new Error("remotePort is required for local port forwarding");
    }

    const forwardId = `fwd-${++this.forwardCounter}`;

    const portForward: PortForward = {
      id: forwardId,
      type: "local",
      localPort,
      remoteHost,
      remotePort,
      active: false,
      createdAt: new Date(),
    };

    if (session.type === "ssh2" && session.sshClient) {
      await this.startSsh2LocalForward(session.sshClient, portForward);
    } else if (session.type === "child_process") {
      await this.startShellLocalForward(session, portForward);
    } else {
      throw new Error("Session type does not support port forwarding");
    }

    session.portForwards.push(portForward);
    return portForward;
  }

  /**
   * Start a remote port forward (remote -> local)
   * Listens on remote port, forwards to local host:port
   */
  async startRemoteForward(
    session: ShellSession,
    options: PortForwardOptions
  ): Promise<PortForward> {
    const { localPort, remoteHost = "localhost", remotePort } = options;

    if (!remotePort) {
      throw new Error("remotePort is required for remote port forwarding");
    }

    const forwardId = `fwd-${++this.forwardCounter}`;

    const portForward: PortForward = {
      id: forwardId,
      type: "remote",
      localPort,
      remoteHost,
      remotePort,
      active: false,
      createdAt: new Date(),
    };

    if (session.type === "ssh2" && session.sshClient) {
      await this.startSsh2RemoteForward(session.sshClient, portForward);
    } else {
      throw new Error("Remote port forwarding requires SSH2 session");
    }

    session.portForwards.push(portForward);
    return portForward;
  }

  /**
   * Start a dynamic (SOCKS) forward
   */
  async startDynamicForward(
    session: ShellSession,
    localPort: number
  ): Promise<PortForward> {
    const forwardId = `fwd-${++this.forwardCounter}`;

    const portForward: PortForward = {
      id: forwardId,
      type: "dynamic",
      localPort,
      active: false,
      createdAt: new Date(),
    };

    // Dynamic forwarding is complex - for now, suggest using ssh -D
    throw new Error(
      "Dynamic forwarding not yet implemented. Use: ssh -D " + localPort + " for SOCKS proxy."
    );
  }

  /**
   * Stop a port forward
   */
  async stopForward(session: ShellSession, forwardId: string): Promise<boolean> {
    const activeForward = this.activeForwards.get(forwardId);

    if (!activeForward) {
      // Try to find in session's port forwards
      const idx = session.portForwards.findIndex(pf => pf.id === forwardId);
      if (idx !== -1) {
        session.portForwards.splice(idx, 1);
      }
      return false;
    }

    // Close all connections
    for (const socket of activeForward.connections) {
      socket.destroy();
    }

    // Stop server
    if (activeForward.server) {
      activeForward.server.close();
    }

    // Kill process
    if (activeForward.process) {
      activeForward.process.kill();
    }

    activeForward.portForward.active = false;
    this.activeForwards.delete(forwardId);

    // Remove from session
    const idx = session.portForwards.findIndex(pf => pf.id === forwardId);
    if (idx !== -1) {
      session.portForwards.splice(idx, 1);
    }

    return true;
  }

  /**
   * Stop all forwards for a session
   */
  async stopAllForwards(session: ShellSession): Promise<number> {
    let count = 0;

    for (const portForward of [...session.portForwards]) {
      const stopped = await this.stopForward(session, portForward.id);
      if (stopped) count++;
    }

    return count;
  }

  /**
   * List active forwards
   */
  listForwards(session: ShellSession): PortForward[] {
    return session.portForwards;
  }

  /**
   * SSH2 local port forward implementation
   */
  private async startSsh2LocalForward(
    client: Client,
    portForward: PortForward
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        const activeForward = this.activeForwards.get(portForward.id);
        if (activeForward) {
          activeForward.connections.add(socket);
        }

        client.forwardOut(
          "127.0.0.1",
          portForward.localPort,
          portForward.remoteHost!,
          portForward.remotePort!,
          (err, stream) => {
            if (err) {
              socket.end();
              return;
            }

            socket.pipe(stream);
            stream.pipe(socket);

            socket.on("close", () => {
              stream.end();
              const af = this.activeForwards.get(portForward.id);
              if (af) {
                af.connections.delete(socket);
              }
            });

            stream.on("close", () => {
              socket.end();
            });
          }
        );
      });

      server.on("error", (err) => {
        reject(new Error(`Port forward error: ${err.message}`));
      });

      server.listen(portForward.localPort, "127.0.0.1", () => {
        portForward.active = true;

        this.activeForwards.set(portForward.id, {
          portForward,
          server,
          connections: new Set(),
        });

        resolve();
      });
    });
  }

  /**
   * SSH2 remote port forward implementation
   */
  private async startSsh2RemoteForward(
    client: Client,
    portForward: PortForward
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      client.forwardIn("0.0.0.0", portForward.remotePort!, (err) => {
        if (err) {
          reject(new Error(`Remote forward error: ${err.message}`));
          return;
        }

        portForward.active = true;

        // Handle incoming connections
        client.on("tcp connection", (info, accept, reject) => {
          if (info.destPort === portForward.remotePort) {
            const stream = accept();
            const socket = new Socket();

            socket.connect(portForward.localPort, "127.0.0.1", () => {
              socket.pipe(stream);
              stream.pipe(socket);
            });

            socket.on("error", () => stream.end());
            stream.on("close", () => socket.end());
          }
        });

        this.activeForwards.set(portForward.id, {
          portForward,
          connections: new Set(),
        });

        resolve();
      });
    });
  }

  /**
   * Shell-based local port forward (using ssh -L in background)
   */
  private async startShellLocalForward(
    session: ShellSession,
    portForward: PortForward
  ): Promise<void> {
    // For child process sessions, we need to extract connection info
    // and start a separate SSH tunnel

    // Extract host info from session
    const originalCmd = session.originalCommand;

    // Try to extract SSH details with better parsing
    const sshDetails = this.parseSshCommand(originalCmd);
    const gcloudMatch = originalCmd.match(/gcloud\s+compute\s+ssh\s+["']?([^\s"']+)["']?.*--project\s+["']?([^\s"']+)["']?/);

    if (sshDetails) {
      const { user, host, identityFile, port, otherOptions } = sshDetails;

      // Build SSH command with all necessary options
      const sshArgs: string[] = ["-N"];

      if (identityFile) {
        sshArgs.push("-i", identityFile);
      }

      if (port && port !== 22) {
        sshArgs.push("-p", String(port));
      }

      // Add other options like StrictHostKeyChecking
      sshArgs.push(...otherOptions);

      // Add the port forward
      sshArgs.push("-L", `${portForward.localPort}:${portForward.remoteHost}:${portForward.remotePort}`);

      // Add the host
      sshArgs.push(user ? `${user}@${host}` : host);

      const sshCmd = `ssh ${sshArgs.join(" ")}`;

      const proc = spawn("sh", ["-c", sshCmd], {
        detached: true,
        stdio: "ignore",
      });

      proc.unref();

      portForward.active = true;
      this.activeForwards.set(portForward.id, {
        portForward,
        process: proc,
        connections: new Set(),
      });

      return;
    }

    if (gcloudMatch) {
      const [, instance, project] = gcloudMatch;
      const gcloudCmd = `gcloud compute ssh ${instance} --project=${project} -- -N -L ${portForward.localPort}:${portForward.remoteHost}:${portForward.remotePort}`;

      const proc = spawn("sh", ["-c", gcloudCmd], {
        detached: true,
        stdio: "ignore",
      });

      proc.unref();

      portForward.active = true;
      this.activeForwards.set(portForward.id, {
        portForward,
        process: proc,
        connections: new Set(),
      });

      return;
    }

    throw new Error(
      "Could not extract connection details for port forwarding. " +
      "Port forwarding works best with SSH2 sessions or direct SSH commands."
    );
  }

  /**
   * Parse SSH command to extract connection details
   */
  private parseSshCommand(cmd: string): {
    user: string | null;
    host: string;
    identityFile: string | null;
    port: number | null;
    otherOptions: string[];
  } | null {
    // Check if this is an SSH command
    if (!cmd.trim().startsWith("ssh ")) {
      return null;
    }

    let identityFile: string | null = null;
    let port: number | null = null;
    const otherOptions: string[] = [];
    let user: string | null = null;
    let host: string | null = null;

    // Extract identity file (-i option) with support for quoted paths
    const identityMatch = cmd.match(/-i\s+["']?([^"'\s]+(?:\s+[^"'\s-][^"'\s]*)*|[^"'\s]+)["']?/);
    if (identityMatch) {
      identityFile = identityMatch[1].replace(/^~/, process.env.HOME || "~");
    }

    // Extract port (-p option)
    const portMatch = cmd.match(/-p\s+(\d+)/);
    if (portMatch) {
      port = parseInt(portMatch[1], 10);
    }

    // Extract other common options we should preserve
    if (cmd.includes("StrictHostKeyChecking=no") || cmd.includes("StrictHostKeyChecking=accept-new")) {
      const strictMatch = cmd.match(/-o\s+StrictHostKeyChecking=\w+/);
      if (strictMatch) {
        otherOptions.push(strictMatch[0]);
      }
    }

    // Extract user@host - look for the last argument that looks like [user@]host
    // This handles cases where options come before the host
    const parts = cmd.split(/\s+/);
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      // Skip if it's a quoted value, an option, or part of an option value
      if (part.startsWith("-") || part.startsWith('"') || part.startsWith("'")) {
        continue;
      }
      // Skip if previous part is an option that takes a value
      if (i > 0 && ["-i", "-p", "-o", "-F", "-l", "-J"].includes(parts[i - 1])) {
        continue;
      }
      // Check if this looks like a host or user@host
      if (part.includes("@")) {
        const atIndex = part.indexOf("@");
        user = part.substring(0, atIndex);
        host = part.substring(atIndex + 1);
        break;
      } else if (part.match(/^[\w.-]+$/)) {
        // Could be just a host
        host = part;
        break;
      }
    }

    if (!host) {
      return null;
    }

    return { user, host, identityFile, port, otherOptions };
  }
}

// Singleton instance
export const portForwarder = new PortForwarder();
