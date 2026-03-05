/**
 * Split the current pane
 */
export declare function handlePaneSplit(params: {
    direction: "horizontal" | "vertical";
    sessionId?: string;
    paneId?: string;
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
 * Focus (switch to) a pane
 */
export declare function handlePaneFocus(params: {
    paneId: string;
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
 * Close a pane
 */
export declare function handlePaneClose(params: {
    paneId: string;
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
 * List panes for a session
 */
export declare function handlePaneList(params: {
    sessionId?: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * Execute command in a specific pane
 */
export declare function handlePaneExec(params: {
    paneId: string;
    command: string;
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
 * Broadcast command to all panes
 */
export declare function handlePaneBroadcast(params: {
    command: string;
    sessionId?: string;
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
 * Rename a pane
 */
export declare function handlePaneRename(params: {
    paneId: string;
    name: string;
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
 * Focus next pane
 */
export declare function handlePaneNext(params: {
    sessionId?: string;
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
export declare function getPaneToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            direction: {
                type: string;
                enum: string[];
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            paneId: {
                type: string;
                description: string;
            };
            command?: undefined;
            name?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            paneId: {
                type: string;
                description: string;
            };
            direction?: undefined;
            sessionId?: undefined;
            command?: undefined;
            name?: undefined;
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
            direction?: undefined;
            paneId?: undefined;
            command?: undefined;
            name?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            paneId: {
                type: string;
                description: string;
            };
            command: {
                type: string;
                description: string;
            };
            direction?: undefined;
            sessionId?: undefined;
            name?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            direction?: undefined;
            paneId?: undefined;
            name?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            paneId: {
                type: string;
                description: string;
            };
            name: {
                type: string;
                description: string;
            };
            direction?: undefined;
            sessionId?: undefined;
            command?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=pane-tools.d.ts.map