export declare function stripAnsi(str: string): string;
export declare const COLORS: {
    reset: string;
    bold: string;
    dim: string;
    cyan: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    red: string;
    white: string;
    gray: string;
    bgBlue: string;
    bgGreen: string;
    bgRed: string;
    bgYellow: string;
};
export declare function formatPrompt(sessionName: string, command: string): string;
export declare function formatOutputStart(): string;
export declare function formatOutputEnd(): string;
export declare function formatSessionStatus(connected: boolean): string;
export declare function formatWorkingDir(dir: string): string;
export declare function formatError(message: string): string;
export declare function formatSuccess(message: string): string;
export declare function formatWarning(message: string): string;
export declare function formatInfo(message: string): string;
//# sourceMappingURL=ansi.d.ts.map