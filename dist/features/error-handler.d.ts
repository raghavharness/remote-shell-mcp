import { ErrorContext } from "../utils/terminal-ui.js";
export interface ErrorAnalysis {
    isError: boolean;
    errorType?: ErrorType;
    exitCode?: number;
    stderr?: string;
    context: ErrorContext;
}
export type ErrorType = "permission_denied" | "command_not_found" | "file_not_found" | "directory_not_found" | "connection_refused" | "timeout" | "syntax_error" | "package_not_found" | "disk_full" | "memory_error" | "network_error" | "authentication_failed" | "unknown";
/**
 * Analyze command output for errors
 */
export declare function analyzeError(command: string, output: string, exitCode?: number): ErrorAnalysis;
/**
 * Check if an error is auto-fixable
 */
export declare function isAutoFixable(analysis: ErrorAnalysis): boolean;
/**
 * Get the suggested fix command
 */
export declare function getSuggestedFix(analysis: ErrorAnalysis): string | undefined;
declare class ErrorHandler {
    private osCache;
    private pmCache;
    /**
     * Cache OS detection for a session
     */
    setOsForSession(sessionId: string, os: string): void;
    /**
     * Cache package manager for a session
     */
    setPackageManagerForSession(sessionId: string, pm: string): void;
    /**
     * Get cached OS for session
     */
    getOsForSession(sessionId: string): string | undefined;
    /**
     * Get cached package manager for session
     */
    getPackageManagerForSession(sessionId: string): string | undefined;
    /**
     * Analyze error with session context
     */
    analyzeWithSession(sessionId: string, command: string, output: string, exitCode?: number): ErrorAnalysis;
    /**
     * Clear session cache
     */
    clearSession(sessionId: string): void;
}
export declare const errorHandler: ErrorHandler;
export {};
//# sourceMappingURL=error-handler.d.ts.map