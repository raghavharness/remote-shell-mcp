interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Handle file upload tool
 */
export declare function handleFileUpload(params: {
    localPath: string;
    remotePath: string;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle file download tool
 */
export declare function handleFileDownload(params: {
    remotePath: string;
    localPath: string;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle list remote directory tool
 */
export declare function handleListRemote(params: {
    path: string;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Get file tool definitions
 */
export declare function getFileToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            localPath: {
                type: string;
                description: string;
            };
            remotePath: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            path?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            localPath?: undefined;
            remotePath?: undefined;
        };
        required: string[];
    };
})[];
export {};
//# sourceMappingURL=file-tools.d.ts.map