import { SmartWaitConfig } from "../types.js";
export declare const DEFAULT_SMART_WAIT_CONFIG: SmartWaitConfig;
export declare class SmartWait {
    private config;
    constructor(config?: SmartWaitConfig);
    /**
     * Calculate the appropriate wait time for a command
     */
    getWaitTime(command: string, explicitWaitTime?: number): number;
    /**
     * Get description of why a wait time was chosen
     */
    getWaitTimeReason(command: string): string | null;
    /**
     * Check if command is likely to be long-running
     */
    isLongRunning(command: string): boolean;
    /**
     * Check if command is likely to be quick
     */
    isQuickCommand(command: string): boolean;
    /**
     * Add a custom pattern
     */
    addPattern(pattern: RegExp, waitTime: number, description: string): void;
    /**
     * Update base wait time
     */
    setBaseWaitTime(waitTime: number): void;
}
export declare const smartWait: SmartWait;
//# sourceMappingURL=smart-wait.d.ts.map