export declare const ICONS: {
    folder: string;
    connected: string;
    disconnected: string;
    clock: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    suggestion: string;
    autoFix: string;
    command: string;
};
export interface TerminalBoxOptions {
    title?: string;
    width?: number;
    sessionName?: string;
    workingDir?: string;
    connected?: boolean;
    uptime?: string;
}
/**
 * Create a framed terminal box header
 */
export declare function formatBoxHeader(options: TerminalBoxOptions): string;
/**
 * Format a command line within the box
 */
export declare function formatBoxCommand(command: string, width?: number): string;
/**
 * Create a box footer
 */
export declare function formatBoxFooter(width?: number): string;
/**
 * Format the main prompt line (always shows directory)
 */
export declare function formatTerminalPrompt(sessionName: string, workingDir: string, command: string): string;
/**
 * Format session header with full box UI
 */
export declare function formatSessionHeader(sessionName: string, workingDir: string, connected: boolean, command: string, uptime?: string): string;
/**
 * Format output content (no box, just clean output)
 */
export declare function formatOutputContent(output: string): string;
/**
 * Format an error block with context for AI analysis
 */
export declare function formatErrorBlock(command: string, exitCode: number | undefined, stderr: string, context: ErrorContext): string;
export interface ErrorContext {
    errorType?: string;
    suggestedFix?: string;
    autoFixable?: boolean;
    additionalContext?: string;
    packageManager?: string;
    os?: string;
}
/**
 * Format a success message
 */
export declare function formatSuccess(message: string): string;
/**
 * Format a warning message
 */
export declare function formatWarning(message: string): string;
/**
 * Format an info message
 */
export declare function formatInfo(message: string): string;
/**
 * Calculate uptime string from start date
 */
export declare function formatUptime(startedAt: Date): string;
//# sourceMappingURL=terminal-ui.d.ts.map