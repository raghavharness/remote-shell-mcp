export declare const SESSION_EXIT_PATTERNS: RegExp[];
export declare function isSessionExitCommand(command: string): boolean;
export declare const SESSION_INTERRUPT_PATTERNS: RegExp[];
export declare function isSessionInterruptCommand(command: string): boolean;
export declare const REMOTE_COMMAND_PATTERNS: RegExp[];
export declare function isRemoteShellCommand(command: string): boolean;
export declare function extractSessionName(command: string): string;
export declare const CD_PATTERNS: RegExp[];
export declare function isCdCommand(command: string): boolean;
export declare function extractCdTarget(command: string): string | null;
//# sourceMappingURL=patterns.d.ts.map