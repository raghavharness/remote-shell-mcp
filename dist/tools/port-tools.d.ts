interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Handle start local port forward
 */
export declare function handleStartLocalForward(params: {
    localPort: number;
    remoteHost?: string;
    remotePort: number;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle start remote port forward
 */
export declare function handleStartRemoteForward(params: {
    remotePort: number;
    localHost?: string;
    localPort: number;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle list port forwards
 */
export declare function handleListPortForwards(params: {
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle stop port forward
 */
export declare function handleStopPortForward(params: {
    forwardId: string;
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Handle stop all port forwards
 */
export declare function handleStopAllPortForwards(params: {
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Get port tool definitions
 */
export declare function getPortToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            localPort: {
                type: string;
                description: string;
            };
            remoteHost: {
                type: string;
                description: string;
            };
            remotePort: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            localHost?: undefined;
            forwardId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            remotePort: {
                type: string;
                description: string;
            };
            localHost: {
                type: string;
                description: string;
            };
            localPort: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            remoteHost?: undefined;
            forwardId?: undefined;
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
            localPort?: undefined;
            remoteHost?: undefined;
            remotePort?: undefined;
            localHost?: undefined;
            forwardId?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            forwardId: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            localPort?: undefined;
            remoteHost?: undefined;
            remotePort?: undefined;
            localHost?: undefined;
        };
        required: string[];
    };
})[];
export {};
//# sourceMappingURL=port-tools.d.ts.map