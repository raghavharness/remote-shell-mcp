interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Handle session status tool
 */
export declare function handleSessionStatus(): Promise<ToolResult>;
/**
 * Handle session switch tool
 */
export declare function handleSessionSwitch(params: {
    sessionId: string;
}): Promise<ToolResult>;
/**
 * Handle session end tool
 */
export declare function handleSessionEnd(params: {
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle session history tool
 */
export declare function handleSessionHistory(params: {
    sessionId?: string;
    limit?: number;
}): Promise<ToolResult>;
/**
 * Handle session output tool
 */
export declare function handleSessionOutput(params: {
    sessionId?: string;
    lines?: number;
}): Promise<ToolResult>;
/**
 * Handle session signal tool
 */
export declare function handleSessionSignal(params: {
    signal: string;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle output search tool
 */
export declare function handleOutputSearch(params: {
    query: string;
    sessionId?: string;
    regex?: boolean;
    caseSensitive?: boolean;
    limit?: number;
    includeOutput?: boolean;
}): Promise<ToolResult>;
/**
 * Handle find errors tool
 */
export declare function handleFindErrors(params: {
    sessionId?: string;
    limit?: number;
}): Promise<ToolResult>;
/**
 * Get session tool definitions
 */
export declare function getSessionToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            method: {
                type: string;
                enum: string[];
                description: string;
            };
            host: {
                type: string;
                description: string;
            };
            username: {
                type: string;
                description: string;
            };
            port: {
                type: string;
                description: string;
            };
            password: {
                type: string;
                description: string;
            };
            privateKeyPath: {
                type: string;
                description: string;
            };
            instance: {
                type: string;
                description: string;
            };
            zone: {
                type: string;
                description: string;
            };
            project: {
                type: string;
                description: string;
            };
            targetId: {
                type: string;
                description: string;
            };
            region: {
                type: string;
                description: string;
            };
            vmName: {
                type: string;
                description: string;
            };
            resourceGroup: {
                type: string;
                description: string;
            };
            command: {
                type: string;
                description: string;
            };
            sessionName: {
                type: string;
                description: string;
            };
            autoReconnect: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            limit?: undefined;
            lines?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            sessionId?: undefined;
            limit?: undefined;
            lines?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            limit?: undefined;
            lines?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            limit?: undefined;
            lines?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            lines?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description?: undefined;
            };
            lines: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            limit?: undefined;
            signal?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            signal: {
                type: string;
                enum: string[];
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            limit?: undefined;
            lines?: undefined;
            query?: undefined;
            regex?: undefined;
            caseSensitive?: undefined;
            includeOutput?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            regex: {
                type: string;
                description: string;
            };
            caseSensitive: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            includeOutput: {
                type: string;
                description: string;
            };
            method?: undefined;
            host?: undefined;
            username?: undefined;
            port?: undefined;
            password?: undefined;
            privateKeyPath?: undefined;
            instance?: undefined;
            zone?: undefined;
            project?: undefined;
            targetId?: undefined;
            region?: undefined;
            vmName?: undefined;
            resourceGroup?: undefined;
            command?: undefined;
            sessionName?: undefined;
            autoReconnect?: undefined;
            lines?: undefined;
            signal?: undefined;
        };
        required: string[];
    };
})[];
export {};
//# sourceMappingURL=session-tools.d.ts.map