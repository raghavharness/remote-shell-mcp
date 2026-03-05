export interface ShellToolParams {
    command: string;
    waitTime?: number;
    forceNewSession?: boolean;
    stream?: boolean;
}
export interface ShellToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Handle the main shell tool
 */
export declare function handleShellTool(params: ShellToolParams): Promise<ShellToolResult>;
/**
 * Get tool definition for shell
 */
export declare function getShellToolDefinition(): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
            waitTime: {
                type: string;
                description: string;
            };
            forceNewSession: {
                type: string;
                description: string;
            };
            stream: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=shell.d.ts.map