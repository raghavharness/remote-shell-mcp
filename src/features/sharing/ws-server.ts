import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { shareManager } from "./share-manager.js";
import { sessionManager } from "../../session-manager.js";
import { EventEmitter } from "events";

interface ShareClient {
  ws: WebSocket;
  shareId: string;
  authenticated: boolean;
  permissions: "view" | "control";
}

/**
 * WebSocket Server for session sharing
 *
 * Provides real-time terminal sharing capabilities:
 * - View-only mode: See terminal output
 * - Control mode: Send commands
 */
export class ShareServer extends EventEmitter {
  private httpServer: HttpServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private clients: Map<WebSocket, ShareClient> = new Map();
  private port: number = 3847;
  private running: boolean = false;

  /**
   * Start the share server
   */
  start(port: number = 3847): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.running) {
        resolve();
        return;
      }

      this.port = port;

      // Create HTTP server for health checks and web client
      this.httpServer = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Create WebSocket server
      this.wsServer = new WebSocketServer({ server: this.httpServer });

      this.wsServer.on("connection", (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.httpServer.listen(port, () => {
        this.running = true;
        console.error(`[remote-shell] Share server started on port ${port}`);
        resolve();
      });

      this.httpServer.on("error", (err) => {
        console.error("[remote-shell] Share server error:", err);
        reject(err);
      });
    });
  }

  /**
   * Stop the share server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve();
        return;
      }

      // Close all client connections
      for (const [ws] of this.clients) {
        ws.close(1000, "Server shutting down");
      }
      this.clients.clear();

      // Close servers
      if (this.wsServer) {
        this.wsServer.close();
        this.wsServer = null;
      }

      if (this.httpServer) {
        this.httpServer.close(() => {
          this.running = false;
          console.error("[remote-shell] Share server stopped");
          resolve();
        });
      } else {
        this.running = false;
        resolve();
      }
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || "/";

    // Health check
    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", shares: shareManager.getShareCount() }));
      return;
    }

    // Share page
    if (url.startsWith("/share/")) {
      const shareId = url.split("/")[2];
      const share = shareManager.getShare(shareId);

      if (!share) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Share not found or expired</h1></body></html>");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(this.getShareHtml(shareId, share.permissions));
      return;
    }

    // Default
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body><h1>Remote Shell Share Server</h1><p>Use a share link to view a session.</p></body></html>");
  }

  /**
   * Handle WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const shareId = url.pathname.split("/").pop() || "";

    const share = shareManager.getShare(shareId);
    if (!share) {
      ws.close(4004, "Share not found or expired");
      return;
    }

    const client: ShareClient = {
      ws,
      shareId,
      authenticated: !share.password,
      permissions: share.permissions,
    };

    this.clients.set(ws, client);

    if (client.authenticated) {
      shareManager.clientConnected(shareId);
      // Send session context for proper terminal experience
      const sessionContext = this.getSessionContext(share.sessionId);
      this.sendToClient(ws, {
        type: "connected",
        shareId,
        permissions: client.permissions,
        context: sessionContext,
      });
      // Don't send output history - start with a fresh terminal view
    } else {
      this.sendToClient(ws, {
        type: "auth-required",
      });
    }

    ws.on("message", (data) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      const client = this.clients.get(ws);
      if (client?.authenticated) {
        shareManager.clientDisconnected(client.shareId);
      }
      this.clients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("[remote-shell] WebSocket error:", err);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, data: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "auth":
          this.handleAuth(ws, client, msg.password);
          break;

        case "command":
          this.handleCommand(ws, client, msg.command);
          break;

        case "interrupt":
          this.handleInterrupt(ws, client);
          break;

        case "eof":
          this.handleEof(ws, client);
          break;

        case "complete":
          this.handleTabComplete(ws, client, msg.partial);
          break;

        case "raw":
          // Send raw input to the session (for interactive prompts)
          this.handleRawInput(ws, client, msg.data);
          break;

        case "ping":
          this.sendToClient(ws, { type: "pong" });
          break;

        case "resize":
          // Terminal resize event (for future PTY resize support)
          break;
      }
    } catch (err) {
      console.error("[remote-shell] Message parse error:", err);
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(ws: WebSocket, client: ShareClient, password: string): void {
    const valid = shareManager.validatePassword(client.shareId, password);

    if (valid) {
      client.authenticated = true;
      shareManager.clientConnected(client.shareId);
      const share = shareManager.getShare(client.shareId);
      const sessionContext = share ? this.getSessionContext(share.sessionId) : null;
      this.sendToClient(ws, {
        type: "auth-success",
        permissions: client.permissions,
        context: sessionContext,
      });
      // Don't send output history - start with a fresh terminal view
    } else {
      this.sendToClient(ws, {
        type: "auth-failed",
      });
    }
  }

  /**
   * Handle interrupt signal (Ctrl+C) from client
   */
  private async handleInterrupt(ws: WebSocket, client: ShareClient): Promise<void> {
    if (!client.authenticated || client.permissions !== "control") {
      return;
    }

    const share = shareManager.getShare(client.shareId);
    if (!share) return;

    const session = sessionManager.getSession(share.sessionId);
    if (!session) return;

    try {
      await sessionManager.sendInterrupt(session);
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", message: `Interrupt failed: ${err.message}` });
    }
  }

  /**
   * Handle EOF signal (Ctrl+D) from client
   */
  private async handleEof(ws: WebSocket, client: ShareClient): Promise<void> {
    if (!client.authenticated || client.permissions !== "control") {
      return;
    }

    const share = shareManager.getShare(client.shareId);
    if (!share) return;

    const session = sessionManager.getSession(share.sessionId);
    if (!session) return;

    try {
      // Send Ctrl+D (EOF) to the session
      if (session.type === "child_process" && session.childProcess?.stdin) {
        session.childProcess.stdin.write("\x04");
      }
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", message: `EOF failed: ${err.message}` });
    }
  }

  /**
   * Handle command from client (control mode only)
   */
  private async handleCommand(ws: WebSocket, client: ShareClient, command: string): Promise<void> {
    if (!client.authenticated) {
      this.sendToClient(ws, { type: "error", message: "Not authenticated" });
      return;
    }

    if (client.permissions !== "control") {
      this.sendToClient(ws, { type: "error", message: "View-only mode" });
      return;
    }

    const share = shareManager.getShare(client.shareId);
    if (!share) {
      this.sendToClient(ws, { type: "error", message: "Share expired" });
      return;
    }

    const session = sessionManager.getSession(share.sessionId);
    if (!session) {
      this.sendToClient(ws, { type: "error", message: "Session not found" });
      return;
    }

    // Execute command on the session
    try {
      let actualCommand = command;

      // Handle clear command specially - ensure TERM is set
      if (command.trim() === "clear" || command.trim() === "reset") {
        actualCommand = `TERM=xterm-256color ${command}`;
      }

      // Handle nested SSH commands - force PTY allocation with -tt
      // This fixes "Pseudo-terminal will not be allocated because stdin is not a terminal"
      const trimmedCmd = command.trim();
      if (trimmedCmd.startsWith("ssh ") && !trimmedCmd.includes(" -t")) {
        // Insert -tt after "ssh " to force TTY allocation for nested SSH
        actualCommand = trimmedCmd.replace(/^ssh\s+/, "ssh -tt ");
      }

      // Handle sudo su / su commands - these need special handling
      // No special handling needed as they work through the existing stdin

      if (session.type === "child_process") {
        await sessionManager.execChildProcessCommand(session, actualCommand);
      } else if (session.type === "ssh2") {
        await sessionManager.execSsh2Command(session, actualCommand);
      }
      // Output is automatically broadcast via session manager's output handlers
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", message: `Command failed: ${err.message}` });
    }
  }

  /**
   * Handle tab completion request from client
   */
  private async handleTabComplete(ws: WebSocket, client: ShareClient, partial: string): Promise<void> {
    if (!client.authenticated || client.permissions !== "control") {
      return;
    }

    const share = shareManager.getShare(client.shareId);
    if (!share) return;

    const session = sessionManager.getSession(share.sessionId);
    if (!session) return;

    try {
      if (session.type === "child_process" && session.childProcess?.stdin) {
        // Clear current output buffer to capture completion response
        const bufferBefore = session.outputBuffer.length;

        // Write partial command followed by Tab character
        session.childProcess.stdin.write(partial + "\t");

        // Wait for completion response
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get new output since we sent Tab
        const newOutput = session.outputBuffer.slice(bufferBefore).join("");

        // Send completion result back to client
        this.sendToClient(ws, {
          type: "complete-result",
          partial,
          result: newOutput,
        });
      }
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", message: `Tab completion failed: ${err.message}` });
    }
  }

  /**
   * Handle raw input from client (for interactive prompts like passwords, confirmations)
   */
  private async handleRawInput(ws: WebSocket, client: ShareClient, data: string): Promise<void> {
    if (!client.authenticated || client.permissions !== "control") {
      return;
    }

    const share = shareManager.getShare(client.shareId);
    if (!share) return;

    const session = sessionManager.getSession(share.sessionId);
    if (!session) return;

    try {
      if (session.type === "child_process" && session.childProcess?.stdin) {
        // Write raw data directly to stdin (for password prompts, etc.)
        session.childProcess.stdin.write(data);
      }
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", message: `Raw input failed: ${err.message}` });
    }
  }

  /**
   * Get session context for terminal prompt
   */
  private getSessionContext(sessionId: string): {
    user: string;
    hostname: string;
    directory: string;
    sessionName: string;
  } | null {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;

    // Use tracked currentUser from session
    let user = session.currentUser || "user";
    let hostname = "remote";

    // Parse session name to extract hostname
    // Format can be: "user@hostname", "gcloud:instance", etc.
    if (session.name.includes("@")) {
      const parts = session.name.split("@");
      hostname = parts[1].split(":")[0]; // Remove port if present
    } else if (session.name.startsWith("gcloud:")) {
      // For gcloud, try to extract hostname from original command
      const match = session.originalCommand.match(/compute ssh[^"]*"([^"]+)"/);
      if (match) {
        hostname = match[1];
      } else {
        // Try without quotes
        const parts = session.originalCommand.split(/\s+/);
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === "ssh" && parts[i + 1] && !parts[i + 1].startsWith("-")) {
            hostname = parts[i + 1];
            break;
          }
        }
      }
      // Also try to extract zone as part of hostname for better context
      const zoneMatch = session.originalCommand.match(/--zone\s+"?([^"\s]+)"?/);
      if (zoneMatch && hostname !== "remote") {
        hostname = zoneMatch[1];
      }
    }

    return {
      user,
      hostname,
      directory: session.workingDirectory || "~",
      sessionName: session.name,
    };
  }

  /**
   * Send recent output history to a client
   */
  private sendOutputHistory(ws: WebSocket, sessionId: string): void {
    const session = sessionManager.getSession(sessionId);
    if (!session) return;

    // Send last N lines of output buffer
    const recentOutput = session.outputBuffer.slice(-50).join("");
    if (recentOutput) {
      const normalizedOutput = recentOutput.replace(/\r?\n/g, "\r\n");
      this.sendToClient(ws, {
        type: "history",
        data: normalizedOutput,
      });
    }
  }

  /**
   * Broadcast directory change to all clients
   */
  broadcastDirectoryChange(shareId: string, directory: string): void {
    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "directory-change",
          directory,
        });
      }
    }
  }

  /**
   * Broadcast user change to all clients
   */
  broadcastUserChange(shareId: string, user: string): void {
    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "user-change",
          user,
        });
      }
    }
  }

  /**
   * Broadcast command completion to all clients (for prompt rendering)
   */
  broadcastCommandComplete(shareId: string): void {
    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "command-complete",
        });
      }
    }
  }

  /**
   * Broadcast full context update to all clients
   */
  broadcastContextUpdate(shareId: string, context: { user?: string; hostname?: string; directory?: string }): void {
    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "context-update",
          context,
        });
      }
    }
  }

  /**
   * Broadcast session ended to all clients and close their connections
   */
  broadcastSessionEnded(shareId: string, reason: string = "Session ended"): void {
    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "session-ended",
          reason,
        });
        // Close the WebSocket connection after sending the message
        setTimeout(() => {
          ws.close(1000, reason);
        }, 100);
      }
    }
  }

  /**
   * Broadcast share removed to all clients
   */
  broadcastShareRemoved(shareId: string): void {
    this.broadcastSessionEnded(shareId, "Share has been removed");
  }

  /**
   * Broadcast output to all clients of a share
   */
  broadcastOutput(shareId: string, output: string, isStderr: boolean = false): void {
    // Normalize line endings: replace bare \n with \r\n for proper cursor reset in xterm.js
    const normalizedOutput = output.replace(/\r?\n/g, "\r\n");

    for (const [ws, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "output",
          data: normalizedOutput,
          isStderr,
        });
      }
    }
  }

  /**
   * Send message to client
   */
  private sendToClient(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Get the share HTML page with xterm.js terminal emulator
   */
  private getShareHtml(shareId: string, permissions: "view" | "control"): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Remote Shell - Shared Session</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body {
      background: #1a1a2e;
      color: #eee;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 8px 16px;
      background: linear-gradient(135deg, #1e3a5f 0%, #16213e 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2d4a6f;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      font-weight: 600;
      font-size: 14px;
      color: #64b5f6;
    }
    .session-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      font-size: 13px;
      font-family: 'Menlo', 'Monaco', 'Cascadia Code', monospace;
    }
    .session-user {
      color: #3fb950;
      font-weight: 500;
    }
    .session-host {
      color: #58a6ff;
    }
    .session-dir {
      color: #bc8cff;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0,0,0,0.3);
      border-radius: 12px;
      font-size: 12px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f44336;
    }
    .status-dot.connected { background: #4caf50; }
    .mode-badge {
      padding: 4px 10px;
      background: ${permissions === "control" ? "#2e7d32" : "#1565c0"};
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    #terminal-container {
      flex: 1;
      padding: 4px;
      background: #0d1117;
      min-height: 0;
    }
    #terminal {
      height: 100%;
    }
    #auth-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    #auth-form {
      background: linear-gradient(135deg, #1e3a5f 0%, #16213e 100%);
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      text-align: center;
    }
    #auth-form h3 {
      margin-bottom: 20px;
      font-weight: 500;
    }
    #auth-form input {
      display: block;
      margin: 12px auto;
      padding: 12px 16px;
      width: 260px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #eee;
      font-size: 14px;
    }
    #auth-form input:focus {
      outline: none;
      border-color: #64b5f6;
    }
    #auth-btn {
      margin-top: 16px;
      padding: 10px 32px;
      background: #1565c0;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #auth-btn:hover {
      background: #1976d2;
    }
    .xterm {
      padding: 8px;
    }
    /* Enhanced cursor styling - bright green glow */
    .xterm-cursor-layer {
      z-index: 10;
    }
    .xterm-cursor {
      box-shadow: 0 0 6px rgba(0, 255, 136, 0.7);
    }
    @keyframes cursor-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(0, 255, 136, 0.7); }
      50% { box-shadow: 0 0 12px rgba(0, 255, 136, 1), 0 0 20px rgba(0, 255, 136, 0.5); }
    }
    .xterm-cursor-block {
      animation: cursor-glow 1s ease-in-out infinite;
    }
    /* Make cursor outline visible when terminal loses focus */
    .xterm:not(.focus) .xterm-cursor {
      border: 2px solid #00ff88 !important;
      background: transparent !important;
    }
    .xterm-viewport::-webkit-scrollbar {
      width: 10px;
    }
    .xterm-viewport::-webkit-scrollbar-track {
      background: #161b22;
    }
    .xterm-viewport::-webkit-scrollbar-thumb {
      background: #30363d;
      border-radius: 5px;
    }
    .xterm-viewport::-webkit-scrollbar-thumb:hover {
      background: #484f58;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="logo">Remote Shell</span>
      <div class="session-info" id="session-info" style="display: none;">
        <span class="session-user" id="session-user"></span>
        <span style="color: #6e7681;">@</span>
        <span class="session-host" id="session-host"></span>
        <span style="color: #6e7681;">:</span>
        <span class="session-dir" id="session-dir"></span>
      </div>
      <div class="status-badge">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">Connecting...</span>
      </div>
    </div>
    <span class="mode-badge">${permissions === "control" ? "Control Mode" : "View Only"}</span>
  </div>

  <div id="terminal-container">
    <div id="terminal"></div>
  </div>

  <div id="auth-modal">
    <div id="auth-form">
      <h3>Password Required</h3>
      <input type="password" id="password-input" placeholder="Enter password" autofocus />
      <button id="auth-btn">Connect</button>
    </div>
  </div>

  <script>
    // Session context for prompt
    let sessionContext = {
      user: 'user',
      hostname: 'remote',
      directory: '~'
    };

    // Initialize xterm.js terminal
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 2,
      cursorInactiveStyle: 'outline',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Cascadia Code", "Fira Code", Consolas, monospace',
      lineHeight: 1.2,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#00ff88',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      allowProposedApi: true
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // Handle window resize
    window.addEventListener('resize', () => {
      fitAddon.fit();
    });

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(document.getElementById('terminal-container'));

    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const sessionInfo = document.getElementById('session-info');
    const sessionUserEl = document.getElementById('session-user');
    const sessionHostEl = document.getElementById('session-host');
    const sessionDirEl = document.getElementById('session-dir');
    const authModal = document.getElementById('auth-modal');
    const passwordInput = document.getElementById('password-input');
    const authBtn = document.getElementById('auth-btn');

    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Format directory for display (shorten home paths)
    function formatDir(dir) {
      if (!dir) return '~';
      // Convert /home/user to ~
      const homeMatch = dir.match(/^\\/home\\/([^\\/]+)(\\/.*)?$/);
      if (homeMatch && homeMatch[1] === sessionContext.user) {
        return '~' + (homeMatch[2] || '');
      }
      return dir;
    }

    // Update session info in header
    function updateSessionInfo() {
      sessionUserEl.textContent = sessionContext.user;
      sessionHostEl.textContent = sessionContext.hostname;
      sessionDirEl.textContent = formatDir(sessionContext.directory);
      sessionInfo.style.display = 'flex';
    }

    // Generate colored prompt string
    function getPrompt() {
      const user = '\\x1b[32m' + sessionContext.user + '\\x1b[0m';
      const host = '\\x1b[34m' + sessionContext.hostname + '\\x1b[0m';
      const dir = '\\x1b[35m' + formatDir(sessionContext.directory) + '\\x1b[0m';
      return user + '@' + host + ':' + dir + '$ ';
    }

    // Write prompt to terminal
    function writePrompt() {
      term.write(getPrompt());
    }

    function connect() {
      ws = new WebSocket('ws://' + location.host + '/ws/${shareId}');

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          term.write('\\r\\n\\x1b[33mConnection lost. Reconnecting... (attempt ' + reconnectAttempts + '/' + maxReconnectAttempts + ')\\x1b[0m\\r\\n');
          setTimeout(connect, 2000 * reconnectAttempts);
        } else {
          term.write('\\r\\n\\x1b[31mConnection lost. Please refresh the page.\\x1b[0m\\r\\n');
        }
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch(msg.type) {
          case 'auth-required':
            authModal.style.display = 'flex';
            passwordInput.focus();
            break;
          case 'auth-success':
            authModal.style.display = 'none';
            if (msg.context) {
              sessionContext = { ...sessionContext, ...msg.context };
              updateSessionInfo();
            }
            term.write('\\x1b[32mConnected to shared session\\x1b[0m\\r\\n\\r\\n');
            ${permissions === "control" ? "writePrompt();" : ""}
            break;
          case 'auth-failed':
            term.write('\\x1b[31mInvalid password\\x1b[0m\\r\\n');
            passwordInput.value = '';
            passwordInput.focus();
            break;
          case 'connected':
            if (msg.context) {
              sessionContext = { ...sessionContext, ...msg.context };
              updateSessionInfo();
            }
            term.write('\\x1b[32mConnected to shared session (${permissions} mode)\\x1b[0m\\r\\n');
            ${permissions === "control" ? "term.write('\\x1b[90mType commands below. Output appears in real-time.\\x1b[0m\\r\\n\\r\\n'); writePrompt();" : ""}
            break;
          case 'history':
            // Display recent output history
            term.write(msg.data);
            break;
          case 'output':
            // If stderr, wrap in red ANSI color
            if (msg.isStderr) {
              term.write('\\x1b[31m' + msg.data + '\\x1b[0m');
            } else {
              term.write(msg.data);
            }
            // Try to detect context changes from output (PS1 parsing)
            detectContextChange(msg.data);
            break;
          case 'directory-change':
            sessionContext.directory = msg.directory;
            updateSessionInfo();
            break;
          case 'user-change':
            sessionContext.user = msg.user;
            updateSessionInfo();
            break;
          case 'context-update':
            if (msg.context) {
              sessionContext = { ...sessionContext, ...msg.context };
              updateSessionInfo();
            }
            break;
          case 'command-complete':
            // Command finished, show prompt in control mode
            ${permissions === "control" ? "writePrompt();" : ""}
            break;
          case 'session-ended':
            setConnected(false);
            term.write('\\r\\n\\x1b[31m' + (msg.reason || 'Session ended') + '\\x1b[0m\\r\\n');
            // Prevent auto-reconnect since session is intentionally ended
            reconnectAttempts = maxReconnectAttempts;
            break;
          case 'error':
            term.write('\\x1b[31mError: ' + msg.message + '\\x1b[0m\\r\\n');
            ${permissions === "control" ? "writePrompt();" : ""}
            break;
          case 'complete-result':
            ${permissions === "control" ? `
            pendingCompletion = false;
            // Process completion result
            if (msg.result) {
              // Check if it's a partial completion (single match) or multiple options
              const result = msg.result;

              // Look for bell character (multiple matches with common prefix)
              const hasBell = result.includes('\\x07');

              // Check if result contains newlines (multiple options displayed)
              if (result.includes('\\n') && !hasBell) {
                // Multiple options - show them and redraw prompt
                term.write('\\r\\n' + result);
                writePrompt();
                term.write(inputBuffer);
                cursorPos = inputBuffer.length;
              } else {
                // Single completion or partial - extract completed text
                // The completion output typically contains the completed portion
                const cleanResult = result.replace(/\\x07/g, '').replace(/\\s+$/g, '');

                if (cleanResult.length > 0) {
                  // Check if it's just echoing back what we typed
                  if (!cleanResult.startsWith(inputBuffer)) {
                    // Append the completion to our input
                    const oldLen = inputBuffer.length;
                    inputBuffer = cleanResult;
                    cursorPos = inputBuffer.length;

                    // Clear current line and rewrite with completion
                    term.write('\\x1b[' + oldLen + 'D\\x1b[K' + inputBuffer);
                  }
                }
              }
            }
            ` : ""}
            break;
        }
      };
    }

    // Try to detect context changes (user, hostname, directory) from terminal output
    function detectContextChange(data) {
      // Common prompt patterns that include user@host:dir
      const patterns = [
        // user@host:dir$ or user@host:dir#
        /([\\w.-]+)@([\\w.-]+):([~\\/][^\\$#\\n]*)[$#]\\s*$/m,
        // [user@host dir]$ or [user@host dir]#
        /\\[([\\w.-]+)@([\\w.-]+)\\s+([~\\/][^\\]\\n]*)\\][$#]\\s*$/m,
      ];

      let updated = false;
      for (const pattern of patterns) {
        const match = data.match(pattern);
        if (match) {
          const newUser = match[1].trim();
          const newHost = match[2].trim();
          const newDir = match[3].trim();

          if (newUser && newUser !== sessionContext.user) {
            sessionContext.user = newUser;
            updated = true;
          }
          if (newHost && newHost !== sessionContext.hostname) {
            sessionContext.hostname = newHost;
            updated = true;
          }
          if (newDir && newDir !== sessionContext.directory) {
            sessionContext.directory = newDir;
            updated = true;
          }

          if (updated) {
            updateSessionInfo();
          }
          break;
        }
      }
    }

    function setConnected(connected) {
      statusDot.className = 'status-dot' + (connected ? ' connected' : '');
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    // Handle keyboard input for control mode
    ${permissions === "control" ? `
    let inputBuffer = '';
    let cursorPos = 0;
    let pendingCompletion = false;

    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Handle special keys
        if (data === '\\r') {
          // Enter key - send the command
          term.write('\\r\\n');
          if (inputBuffer.trim()) {
            ws.send(JSON.stringify({ type: 'command', command: inputBuffer }));
          } else {
            writePrompt();
          }
          inputBuffer = '';
          cursorPos = 0;
        } else if (data === '\\x7f' || data === '\\b') {
          // Backspace
          if (cursorPos > 0) {
            inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
            cursorPos--;
            // Redraw line
            term.write('\\b\\x1b[K' + inputBuffer.slice(cursorPos));
            // Move cursor back
            if (inputBuffer.length > cursorPos) {
              term.write('\\x1b[' + (inputBuffer.length - cursorPos) + 'D');
            }
          }
        } else if (data === '\\x03') {
          // Ctrl+C - interrupt current command
          ws.send(JSON.stringify({ type: 'interrupt' }));
          inputBuffer = '';
          cursorPos = 0;
          term.write('^C\\r\\n');
          writePrompt();
        } else if (data === '\\x04') {
          // Ctrl+D - EOF (logout if line is empty, otherwise delete char)
          if (inputBuffer.length === 0) {
            ws.send(JSON.stringify({ type: 'eof' }));
            term.write('\\r\\n\\x1b[33mSession closed (EOF)\\x1b[0m\\r\\n');
          } else if (cursorPos < inputBuffer.length) {
            // Delete character under cursor
            inputBuffer = inputBuffer.slice(0, cursorPos) + inputBuffer.slice(cursorPos + 1);
            term.write('\\x1b[K' + inputBuffer.slice(cursorPos));
            if (inputBuffer.length > cursorPos) {
              term.write('\\x1b[' + (inputBuffer.length - cursorPos) + 'D');
            }
          }
        } else if (data === '\\x15') {
          // Ctrl+U - clear line
          if (inputBuffer.length > 0) {
            term.write('\\x1b[' + cursorPos + 'D\\x1b[K');
            inputBuffer = '';
            cursorPos = 0;
          }
        } else if (data === '\\x0c') {
          // Ctrl+L - clear screen
          term.clear();
          writePrompt();
          term.write(inputBuffer);
        } else if (data === '\\x1b[D') {
          // Left arrow
          if (cursorPos > 0) {
            cursorPos--;
            term.write(data);
          }
        } else if (data === '\\x1b[C') {
          // Right arrow
          if (cursorPos < inputBuffer.length) {
            cursorPos++;
            term.write(data);
          }
        } else if (data === '\\x1b[H' || data === '\\x01') {
          // Home or Ctrl+A
          if (cursorPos > 0) {
            term.write('\\x1b[' + cursorPos + 'D');
            cursorPos = 0;
          }
        } else if (data === '\\x1b[F' || data === '\\x05') {
          // End or Ctrl+E
          if (cursorPos < inputBuffer.length) {
            term.write('\\x1b[' + (inputBuffer.length - cursorPos) + 'C');
            cursorPos = inputBuffer.length;
          }
        } else if (data === '\\t') {
          // Tab key - request completion from server
          if (inputBuffer.length > 0 && !pendingCompletion) {
            pendingCompletion = true;
            ws.send(JSON.stringify({ type: 'complete', partial: inputBuffer }));
          }
        } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
          // Regular printable ASCII characters
          inputBuffer = inputBuffer.slice(0, cursorPos) + data + inputBuffer.slice(cursorPos);
          cursorPos += data.length;
          // Write character and rest of line
          term.write(data + inputBuffer.slice(cursorPos));
          // Move cursor back if needed
          if (inputBuffer.length > cursorPos) {
            term.write('\\x1b[' + (inputBuffer.length - cursorPos) + 'D');
          }
        }
      }
    });
    ` : '// View-only mode - no input handling'}

    // Auth form handling
    authBtn.onclick = () => {
      ws.send(JSON.stringify({ type: 'auth', password: passwordInput.value }));
    };
    passwordInput.onkeypress = (e) => {
      if (e.key === 'Enter') authBtn.click();
    };

    // Start connection
    connect();

    // Focus terminal
    term.focus();
  </script>
</body>
</html>`;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get connected client count for a share
   */
  getClientCount(shareId: string): number {
    let count = 0;
    for (const [, client] of this.clients) {
      if (client.shareId === shareId && client.authenticated) {
        count++;
      }
    }
    return count;
  }
}

// Singleton instance
export const shareServer = new ShareServer();
