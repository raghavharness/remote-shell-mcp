/**
 * Start sharing a session
 */
export declare function handleSessionShare(params: {
    sessionId?: string;
    permissions?: "view" | "control";
    password?: string;
    expiresInMinutes?: number;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
} | {
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
}>;
/**
 * Stop sharing a session
 */
export declare function handleSessionUnshare(params: {
    shareId?: string;
    sessionId?: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * List all active shares
 */
export declare function handleSharesList(params: {}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * Update share permissions
 */
export declare function handleShareUpdate(params: {
    shareId: string;
    permissions?: "view" | "control";
    extendMinutes?: number;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
} | {
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
}>;
/**
 * Start share server manually
 */
export declare function handleShareServerStart(params: {
    port?: number;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Stop share server
 */
export declare function handleShareServerStop(params: {}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
export declare function getShareToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            permissions: {
                type: string;
                enum: string[];
                description: string;
            };
            password: {
                type: string;
                description: string;
            };
            expiresInMinutes: {
                type: string;
                description: string;
            };
            shareId?: undefined;
            extendMinutes?: undefined;
            port?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            shareId: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            permissions?: undefined;
            password?: undefined;
            expiresInMinutes?: undefined;
            extendMinutes?: undefined;
            port?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId?: undefined;
            permissions?: undefined;
            password?: undefined;
            expiresInMinutes?: undefined;
            shareId?: undefined;
            extendMinutes?: undefined;
            port?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            shareId: {
                type: string;
                description: string;
            };
            permissions: {
                type: string;
                enum: string[];
                description: string;
            };
            extendMinutes: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            password?: undefined;
            expiresInMinutes?: undefined;
            port?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            port: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            permissions?: undefined;
            password?: undefined;
            expiresInMinutes?: undefined;
            shareId?: undefined;
            extendMinutes?: undefined;
        };
        required?: undefined;
    };
})[];
//# sourceMappingURL=share-tools.d.ts.map