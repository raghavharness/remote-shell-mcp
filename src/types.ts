import { ChildProcess } from "child_process";
import { Client } from "ssh2";

export interface CommandHistoryEntry {
  command: string;
  output: string;
  timestamp: Date;
  exitCode?: number;
  workingDirectory?: string;
}

export interface PortForward {
  id: string;
  type: "local" | "remote" | "dynamic";
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  active: boolean;
  createdAt: Date;
}

export interface ShellSession {
  id: string;
  type: "child_process" | "ssh2";
  name: string;
  description: string;
  originalCommand: string;
  connected: boolean;
  startedAt: Date;
  lastActivity: Date;
  outputBuffer: string[];
  commandHistory: CommandHistoryEntry[];
  workingDirectory: string;
  currentUser: string;
  childProcess?: ChildProcess;
  sshClient?: Client;
  sshStream?: NodeJS.ReadWriteStream;
  portForwards: PortForward[];
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  autoReconnect: boolean;
  // Streaming support
  outputListeners: Set<(data: string) => void>;
  pendingOutput: string;
}

export interface SessionStartOptions {
  method: "ssh" | "gcloud" | "aws" | "azure" | "custom";
  host?: string;
  username?: string;
  port?: number;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  instance?: string;
  zone?: string;
  project?: string;
  targetId?: string;
  region?: string;
  vmName?: string;
  resourceGroup?: string;
  command?: string;
  sessionName?: string;
  autoReconnect?: boolean;
}

export interface FileTransferOptions {
  sessionId?: string;
  localPath: string;
  remotePath: string;
  recursive?: boolean;
  preservePermissions?: boolean;
}

export interface PortForwardOptions {
  sessionId?: string;
  type: "local" | "remote" | "dynamic";
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
}

export interface SmartWaitConfig {
  baseWaitTime: number;
  patterns: Array<{
    pattern: RegExp;
    waitTime: number;
    description: string;
  }>;
}

export interface SearchOptions {
  sessionId?: string;
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  includeOutput?: boolean;
}

export interface SearchResult {
  index: number;
  command: string;
  timestamp: Date;
  matchedText: string;
  context?: string;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting" | "failed";

export interface ConnectionEvent {
  type: "connected" | "disconnected" | "error" | "reconnecting" | "data";
  sessionId: string;
  timestamp: Date;
  data?: string;
  error?: Error;
}

// ============================================================================
// Block-Based Output (Warp-style)
// ============================================================================

export interface OutputBlock {
  id: string;                      // "block-1", "block-2", etc.
  sessionId: string;
  command: string;
  output: string;
  exitCode?: number;
  startedAt: Date;
  completedAt: Date;
  workingDirectory: string;
  collapsed: boolean;
  tags: string[];
  isError: boolean;
}

export interface BlockSearchOptions {
  sessionId?: string;
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  tags?: string[];
}

export interface BlockSearchResult {
  blockId: string;
  command: string;
  matchedText: string;
  timestamp: Date;
  context?: string;
}

// ============================================================================
// Session Persistence
// ============================================================================

export interface SessionState {
  workingDirectory: string;
  environmentVars: Record<string, string>;
  recentCommands: string[];        // Last 10 for replay on reconnect
  lastHeartbeat: Date;
}

export interface PersistedSession {
  id: string;
  persistenceId: string;           // UUID for disk storage
  originalCommand: string;
  name: string;
  state: SessionState;
  createdAt: Date;
  lastActivity: Date;
}

// ============================================================================
// Pane Management (tmux-style)
// ============================================================================

export interface SessionPane {
  id: string;                      // "pane-0", "pane-1"
  sessionId: string;
  name?: string;
  active: boolean;
  outputBuffer: string[];
  commandHistory: CommandHistoryEntry[];
  workingDirectory: string;
  childProcess?: import("child_process").ChildProcess;
  sshStream?: NodeJS.ReadWriteStream;
  outputListeners: Set<(data: string) => void>;
}

export type PaneLayoutType = "single" | "horizontal" | "vertical" | "grid";

export interface PaneLayout {
  type: PaneLayoutType;
  panes: string[];                 // Pane IDs in order
}

// ============================================================================
// Session Sharing
// ============================================================================

export interface SharedSession {
  shareId: string;                 // Short unique ID for sharing
  sessionId: string;
  permissions: "view" | "control";
  expiresAt: Date;
  password?: string;               // Optional protection
  connectedClients: number;
  createdAt: Date;
}

// ============================================================================
// Swarm Management (Multi-machine parallel sessions)
// ============================================================================

export type SwarmConnectionMethod = "ssh" | "gcloud" | "aws" | "azure" | "custom";

export interface SwarmTarget {
  id: string;                      // Unique target identifier
  host?: string;                   // For SSH: hostname/IP
  username?: string;               // For SSH: username
  instance?: string;               // For cloud: instance name
  zone?: string;                   // For GCP
  project?: string;                // For GCP
  region?: string;                 // For AWS
  targetId?: string;               // For AWS SSM
  vmName?: string;                 // For Azure
  resourceGroup?: string;          // For Azure
  command?: string;                // For custom
}

export interface Swarm {
  id: string;                      // "swarm-1"
  name: string;                    // User-friendly name
  method: SwarmConnectionMethod;
  targets: SwarmTarget[];
  sessionIds: string[];            // Associated session IDs
  createdAt: Date;
  status: "creating" | "active" | "partial" | "failed";
  failedTargets: string[];         // Target IDs that failed to connect
}

export interface SwarmExecResult {
  targetId: string;
  sessionId: string;
  output: string;
  isError: boolean;
  exitCode?: number;
}

// ============================================================================
// Real-time Streaming
// ============================================================================

export interface StreamingConfig {
  enabled: boolean;
  errorPatterns: RegExp[];         // Patterns to detect errors
  autoInterrupt: boolean;          // Auto-send Ctrl+C on error
  bufferFlushInterval: number;     // Ms between output flushes
  maxBufferSize: number;           // Max chars before forced flush
}

export interface StreamEvent {
  type: "output" | "error" | "prompt" | "complete" | "interrupted";
  sessionId: string;
  data: string;
  timestamp: Date;
  matchedPattern?: string;         // If error pattern matched
}

// ============================================================================
// TTY Input Support
// ============================================================================

export interface PendingInput {
  sessionId: string;
  prompt: string;                  // The detected prompt text
  detectedAt: Date;
  inputType: "password" | "confirmation" | "text" | "unknown";
}
