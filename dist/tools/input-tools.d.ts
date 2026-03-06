interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Send input to a session (respond to prompts)
 */
export declare function handleSessionInput(params: {
    input: string;
    sessionId?: string;
    hideInput?: boolean;
    waitForOutput?: boolean;
    waitTime?: number;
}): Promise<ToolResult>;
/**
 * Check if a session is waiting for input
 */
export declare function handleCheckPrompt(params: {
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Send confirmation (y/yes or n/no)
 */
export declare function handleConfirm(params: {
    confirm: boolean;
    sessionId?: string;
    waitTime?: number;
}): Promise<ToolResult>;
/**
 * Send password (with hidden display)
 */
export declare function handleSendPassword(params: {
    password: string;
    sessionId?: string;
    waitTime?: number;
}): Promise<ToolResult>;
/**
 * Enable real-time streaming for a session
 */
export declare function handleEnableStreaming(params: {
    sessionId?: string;
    autoInterrupt?: boolean;
    errorPatterns?: string[];
}): Promise<ToolResult>;
/**
 * Disable streaming for a session
 */
export declare function handleDisableStreaming(params: {
    sessionId?: string;
}): Promise<ToolResult>;
/**
 * Get streaming status
 */
export declare function handleStreamingStatus(params: {
    sessionId?: string;
}): Promise<ToolResult>;
export declare function getInputToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            input: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            hideInput: {
                type: string;
                description: string;
            };
            waitForOutput: {
                type: string;
                description: string;
            };
            waitTime: {
                type: string;
                description: string;
            };
            confirm?: undefined;
            password?: undefined;
            autoInterrupt?: undefined;
            errorPatterns?: undefined;
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
            input?: undefined;
            hideInput?: undefined;
            waitForOutput?: undefined;
            waitTime?: undefined;
            confirm?: undefined;
            password?: undefined;
            autoInterrupt?: undefined;
            errorPatterns?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            confirm: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            waitTime: {
                type: string;
                description: string;
            };
            input?: undefined;
            hideInput?: undefined;
            waitForOutput?: undefined;
            password?: undefined;
            autoInterrupt?: undefined;
            errorPatterns?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            password: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            waitTime: {
                type: string;
                description: string;
            };
            input?: undefined;
            hideInput?: undefined;
            waitForOutput?: undefined;
            confirm?: undefined;
            autoInterrupt?: undefined;
            errorPatterns?: undefined;
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
            autoInterrupt: {
                type: string;
                description: string;
            };
            errorPatterns: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            input?: undefined;
            hideInput?: undefined;
            waitForOutput?: undefined;
            waitTime?: undefined;
            confirm?: undefined;
            password?: undefined;
        };
        required?: undefined;
    };
})[];
export {};
//# sourceMappingURL=input-tools.d.ts.map