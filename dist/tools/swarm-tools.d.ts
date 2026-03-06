import { SwarmTarget, SwarmConnectionMethod } from "../types.js";
interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Create a new swarm
 */
export declare function handleSwarmCreate(params: {
    name: string;
    method: SwarmConnectionMethod;
    targets: SwarmTarget[];
    autoReconnect?: boolean;
}): Promise<ToolResult>;
/**
 * List all swarms
 */
export declare function handleSwarmList(): Promise<ToolResult>;
/**
 * Get swarm status/details
 */
export declare function handleSwarmStatus(params: {
    swarmId: string;
}): Promise<ToolResult>;
/**
 * Execute command in swarm (broadcast)
 */
export declare function handleSwarmExec(params: {
    swarmId: string;
    command: string;
    waitTime?: number;
    parallel?: boolean;
    stopOnError?: boolean;
}): Promise<ToolResult>;
/**
 * Send input to all sessions in swarm
 */
export declare function handleSwarmInput(params: {
    swarmId: string;
    input: string;
}): Promise<ToolResult>;
/**
 * Interrupt all sessions in swarm
 */
export declare function handleSwarmInterrupt(params: {
    swarmId: string;
}): Promise<ToolResult>;
/**
 * End a swarm
 */
export declare function handleSwarmEnd(params: {
    swarmId?: string;
}): Promise<ToolResult>;
/**
 * Add target to existing swarm
 */
export declare function handleSwarmAddTarget(params: {
    swarmId: string;
    target: SwarmTarget;
    autoReconnect?: boolean;
}): Promise<ToolResult>;
/**
 * Remove target from swarm
 */
export declare function handleSwarmRemoveTarget(params: {
    swarmId: string;
    targetId: string;
}): Promise<ToolResult>;
export declare function getSwarmToolDefinitions(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name: {
                type: string;
                description: string;
            };
            method: {
                type: string;
                enum: string[];
                description: string;
            };
            targets: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        id: {
                            type: string;
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
                        region: {
                            type: string;
                            description: string;
                        };
                        targetId: {
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
                    };
                };
            };
            autoReconnect: {
                type: string;
                description: string;
            };
            swarmId?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            swarmId?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            command: {
                type: string;
                description: string;
            };
            waitTime: {
                type: string;
                description: string;
            };
            parallel: {
                type: string;
                description: string;
            };
            stopOnError: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            input?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            input: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            target?: undefined;
            targetId?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            target: {
                type: string;
                description: string;
                properties: {
                    id: {
                        type: string;
                    };
                    host: {
                        type: string;
                    };
                    username: {
                        type: string;
                    };
                    instance: {
                        type: string;
                    };
                    zone: {
                        type: string;
                    };
                    project: {
                        type: string;
                    };
                    region: {
                        type: string;
                    };
                    targetId: {
                        type: string;
                    };
                    vmName: {
                        type: string;
                    };
                    resourceGroup: {
                        type: string;
                    };
                    command: {
                        type: string;
                    };
                };
            };
            autoReconnect: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            targetId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            swarmId: {
                type: string;
                description: string;
            };
            targetId: {
                type: string;
                description: string;
            };
            name?: undefined;
            method?: undefined;
            targets?: undefined;
            autoReconnect?: undefined;
            command?: undefined;
            waitTime?: undefined;
            parallel?: undefined;
            stopOnError?: undefined;
            input?: undefined;
            target?: undefined;
        };
        required: string[];
    };
})[];
export {};
//# sourceMappingURL=swarm-tools.d.ts.map