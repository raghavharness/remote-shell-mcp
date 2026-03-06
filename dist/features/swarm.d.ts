import { Swarm, SwarmTarget, SwarmConnectionMethod, SwarmExecResult } from "../types.js";
/**
 * Swarm Manager - Multi-machine parallel session management
 *
 * Enables launching and managing SSH sessions to multiple machines simultaneously,
 * with broadcast command execution and aggregated results.
 */
export declare class SwarmManager {
    private swarms;
    private swarmCounter;
    /**
     * Generate unique swarm ID
     */
    private generateSwarmId;
    /**
     * Create a new swarm from a list of targets
     */
    createSwarm(name: string, method: SwarmConnectionMethod, targets: SwarmTarget[], options?: {
        autoReconnect?: boolean;
    }): Promise<Swarm>;
    /**
     * Start a session for a specific target based on method
     */
    private startSessionForTarget;
    /**
     * Get a swarm by ID
     */
    getSwarm(swarmId: string): Swarm | null;
    /**
     * Get all swarms
     */
    getAllSwarms(): Swarm[];
    /**
     * Execute a command across all sessions in a swarm
     */
    execInSwarm(swarmId: string, command: string, options?: {
        waitTime?: number;
        parallel?: boolean;
        stopOnError?: boolean;
    }): Promise<SwarmExecResult[]>;
    /**
     * Send input to all sessions in a swarm
     */
    sendInputToSwarm(swarmId: string, input: string): Promise<void>;
    /**
     * Send interrupt (Ctrl+C) to all sessions in a swarm
     */
    interruptSwarm(swarmId: string): Promise<void>;
    /**
     * End a swarm (close all sessions)
     */
    endSwarm(swarmId: string): Promise<number>;
    /**
     * End all swarms
     */
    endAllSwarms(): Promise<number>;
    /**
     * Get swarm status summary
     */
    getSwarmStatus(swarmId: string): {
        total: number;
        connected: number;
        disconnected: number;
        failed: number;
    };
    /**
     * Add a target to an existing swarm
     */
    addTargetToSwarm(swarmId: string, target: SwarmTarget, options?: {
        autoReconnect?: boolean;
    }): Promise<boolean>;
    /**
     * Remove a target from a swarm
     */
    removeTargetFromSwarm(swarmId: string, targetId: string): Promise<boolean>;
}
export declare const swarmManager: SwarmManager;
//# sourceMappingURL=swarm.d.ts.map