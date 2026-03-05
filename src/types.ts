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
