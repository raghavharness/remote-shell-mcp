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
export interface OutputBlock {
    id: string;
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
export interface SessionState {
    workingDirectory: string;
    environmentVars: Record<string, string>;
    recentCommands: string[];
    lastHeartbeat: Date;
}
export interface PersistedSession {
    id: string;
    persistenceId: string;
    originalCommand: string;
    name: string;
    state: SessionState;
    createdAt: Date;
    lastActivity: Date;
}
export interface SessionPane {
    id: string;
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
    panes: string[];
}
export interface SharedSession {
    shareId: string;
    sessionId: string;
    permissions: "view" | "control";
    expiresAt: Date;
    password?: string;
    connectedClients: number;
    createdAt: Date;
}
//# sourceMappingURL=types.d.ts.map