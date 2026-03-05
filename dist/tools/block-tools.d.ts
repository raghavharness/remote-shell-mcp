/**
 * List blocks for a session
 */
export declare function handleBlocksList(params: {
    sessionId?: string;
    limit?: number;
    showCollapsed?: boolean;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * Get a specific block
 */
export declare function handleBlockGet(params: {
    blockId: string;
    raw?: boolean;
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
 * Search blocks
 */
export declare function handleBlocksSearch(params: {
    query: string;
    sessionId?: string;
    regex?: boolean;
    limit?: number;
    tags?: string[];
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * Copy block output (returns clean output only)
 */
export declare function handleBlockCopy(params: {
    blockId: string;
    stripAnsi?: boolean;
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
 * Tag a block
 */
export declare function handleBlockTag(params: {
    blockId: string;
    tags: string[];
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
 * Remove tags from a block
 */
export declare function handleBlockUntag(params: {
    blockId: string;
    tags: string[];
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
 * Toggle or set block collapsed state
 */
export declare function handleBlockCollapse(params: {
    blockId: string;
    collapsed?: boolean;
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
 * Get error blocks
 */
export declare function handleBlocksErrors(params: {
    sessionId?: string;
    limit?: number;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
export declare function getBlockToolDefinitions(): ({
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
            showCollapsed: {
                type: string;
                description: string;
            };
            blockId?: undefined;
            raw?: undefined;
            query?: undefined;
            regex?: undefined;
            tags?: undefined;
            stripAnsi?: undefined;
            collapsed?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            blockId: {
                type: string;
                description: string;
            };
            raw: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            limit?: undefined;
            showCollapsed?: undefined;
            query?: undefined;
            regex?: undefined;
            tags?: undefined;
            stripAnsi?: undefined;
            collapsed?: undefined;
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
            limit: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            showCollapsed?: undefined;
            blockId?: undefined;
            raw?: undefined;
            stripAnsi?: undefined;
            collapsed?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            blockId: {
                type: string;
                description: string;
            };
            stripAnsi: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            limit?: undefined;
            showCollapsed?: undefined;
            raw?: undefined;
            query?: undefined;
            regex?: undefined;
            tags?: undefined;
            collapsed?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            blockId: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            sessionId?: undefined;
            limit?: undefined;
            showCollapsed?: undefined;
            raw?: undefined;
            query?: undefined;
            regex?: undefined;
            stripAnsi?: undefined;
            collapsed?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            blockId: {
                type: string;
                description: string;
            };
            collapsed: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            limit?: undefined;
            showCollapsed?: undefined;
            raw?: undefined;
            query?: undefined;
            regex?: undefined;
            tags?: undefined;
            stripAnsi?: undefined;
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
            limit: {
                type: string;
                description: string;
            };
            showCollapsed?: undefined;
            blockId?: undefined;
            raw?: undefined;
            query?: undefined;
            regex?: undefined;
            tags?: undefined;
            stripAnsi?: undefined;
            collapsed?: undefined;
        };
        required?: undefined;
    };
})[];
//# sourceMappingURL=block-tools.d.ts.map