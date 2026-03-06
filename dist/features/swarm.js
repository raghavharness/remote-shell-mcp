import { sessionManager } from "../session-manager.js";
import { smartWait } from "./smart-wait.js";
import { stripAnsi } from "../utils/ansi.js";
/**
 * Swarm Manager - Multi-machine parallel session management
 *
 * Enables launching and managing SSH sessions to multiple machines simultaneously,
 * with broadcast command execution and aggregated results.
 */
export class SwarmManager {
    swarms = new Map();
    swarmCounter = 0;
    /**
     * Generate unique swarm ID
     */
    generateSwarmId() {
        return `swarm-${++this.swarmCounter}`;
    }
    /**
     * Create a new swarm from a list of targets
     */
    async createSwarm(name, method, targets, options = {}) {
        const swarmId = this.generateSwarmId();
        const swarm = {
            id: swarmId,
            name,
            method,
            targets: targets.map((t, idx) => ({
                ...t,
                id: t.id || `target-${idx}`,
            })),
            sessionIds: [],
            createdAt: new Date(),
            status: "creating",
            failedTargets: [],
        };
        this.swarms.set(swarmId, swarm);
        // Start sessions in parallel
        const sessionPromises = swarm.targets.map(async (target) => {
            try {
                const session = await this.startSessionForTarget(method, target, options);
                return { targetId: target.id, sessionId: session.id, success: true };
            }
            catch (error) {
                console.error(`[swarm] Failed to connect to ${target.id}: ${error.message}`);
                return { targetId: target.id, sessionId: null, success: false, error: error.message };
            }
        });
        const results = await Promise.all(sessionPromises);
        // Update swarm with results
        for (const result of results) {
            if (result.success && result.sessionId) {
                swarm.sessionIds.push(result.sessionId);
            }
            else {
                swarm.failedTargets.push(result.targetId);
            }
        }
        // Update status
        if (swarm.sessionIds.length === 0) {
            swarm.status = "failed";
        }
        else if (swarm.failedTargets.length > 0) {
            swarm.status = "partial";
        }
        else {
            swarm.status = "active";
        }
        return swarm;
    }
    /**
     * Start a session for a specific target based on method
     */
    async startSessionForTarget(method, target, options) {
        switch (method) {
            case "ssh": {
                if (!target.host || !target.username) {
                    throw new Error("SSH requires host and username");
                }
                const sshCmd = `ssh ${target.username}@${target.host}`;
                return await sessionManager.startChildProcessSession("ssh", [target.username + "@" + target.host], `${target.username}@${target.host}`, `Swarm SSH to ${target.host}`, sshCmd, options);
            }
            case "gcloud": {
                if (!target.instance) {
                    throw new Error("GCloud requires instance name");
                }
                const gcloudArgs = ["compute", "ssh", target.instance];
                if (target.zone)
                    gcloudArgs.push(`--zone=${target.zone}`);
                if (target.project)
                    gcloudArgs.push(`--project=${target.project}`);
                const cmd = `gcloud ${gcloudArgs.join(" ")}`;
                return await sessionManager.startChildProcessSession("gcloud", gcloudArgs, `gcloud:${target.instance}`, `Swarm GCloud SSH to ${target.instance}`, cmd, options);
            }
            case "aws": {
                if (!target.targetId) {
                    throw new Error("AWS requires targetId");
                }
                const awsArgs = ["ssm", "start-session", "--target", target.targetId];
                if (target.region)
                    awsArgs.push("--region", target.region);
                const cmd = `aws ${awsArgs.join(" ")}`;
                return await sessionManager.startChildProcessSession("aws", awsArgs, `aws:${target.targetId}`, `Swarm AWS SSM to ${target.targetId}`, cmd, options);
            }
            case "azure": {
                if (!target.vmName || !target.resourceGroup) {
                    throw new Error("Azure requires vmName and resourceGroup");
                }
                const azArgs = ["ssh", "vm", "--name", target.vmName, "-g", target.resourceGroup];
                const cmd = `az ${azArgs.join(" ")}`;
                return await sessionManager.startChildProcessSession("az", azArgs, `azure:${target.vmName}`, `Swarm Azure SSH to ${target.vmName}`, cmd, options);
            }
            case "custom": {
                if (!target.command) {
                    throw new Error("Custom method requires command");
                }
                const parts = target.command.split(/\s+/);
                return await sessionManager.startChildProcessSession(parts[0], parts.slice(1), target.id, `Swarm custom: ${target.command}`, target.command, options);
            }
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }
    /**
     * Get a swarm by ID
     */
    getSwarm(swarmId) {
        return this.swarms.get(swarmId) || null;
    }
    /**
     * Get all swarms
     */
    getAllSwarms() {
        return Array.from(this.swarms.values());
    }
    /**
     * Execute a command across all sessions in a swarm
     */
    async execInSwarm(swarmId, command, options = {}) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        const { waitTime, parallel = true, stopOnError = false } = options;
        const actualWaitTime = waitTime ?? smartWait.getWaitTime(command);
        const results = [];
        // Get target ID for each session
        const sessionTargetMap = new Map();
        for (let i = 0; i < swarm.sessionIds.length; i++) {
            const sessionId = swarm.sessionIds[i];
            // Find the target that corresponds to this session (by index, since they were created in order)
            const successfulTargets = swarm.targets.filter(t => !swarm.failedTargets.includes(t.id));
            if (i < successfulTargets.length) {
                sessionTargetMap.set(sessionId, successfulTargets[i].id);
            }
        }
        const execOne = async (sessionId) => {
            const session = sessionManager.getSession(sessionId);
            if (!session) {
                return {
                    targetId: sessionTargetMap.get(sessionId) || sessionId,
                    sessionId,
                    output: "Session not found",
                    isError: true,
                };
            }
            try {
                let output;
                if (session.type === "ssh2") {
                    output = await sessionManager.execSsh2Command(session, command, actualWaitTime);
                }
                else {
                    output = await sessionManager.execChildProcessCommand(session, command, actualWaitTime);
                }
                // Simple error detection
                const isError = /error|failed|denied|not found|permission/i.test(stripAnsi(output));
                return {
                    targetId: sessionTargetMap.get(sessionId) || sessionId,
                    sessionId,
                    output,
                    isError,
                };
            }
            catch (err) {
                return {
                    targetId: sessionTargetMap.get(sessionId) || sessionId,
                    sessionId,
                    output: `Error: ${err.message}`,
                    isError: true,
                };
            }
        };
        if (parallel) {
            // Execute in parallel
            const promises = swarm.sessionIds.map(execOne);
            const parallelResults = await Promise.all(promises);
            results.push(...parallelResults);
        }
        else {
            // Execute sequentially
            for (const sessionId of swarm.sessionIds) {
                const result = await execOne(sessionId);
                results.push(result);
                if (stopOnError && result.isError) {
                    break;
                }
            }
        }
        return results;
    }
    /**
     * Send input to all sessions in a swarm
     */
    async sendInputToSwarm(swarmId, input) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        const promises = swarm.sessionIds.map(async (sessionId) => {
            const session = sessionManager.getSession(sessionId);
            if (session?.childProcess?.stdin) {
                session.childProcess.stdin.write(input);
            }
        });
        await Promise.all(promises);
    }
    /**
     * Send interrupt (Ctrl+C) to all sessions in a swarm
     */
    async interruptSwarm(swarmId) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        const promises = swarm.sessionIds.map(async (sessionId) => {
            const session = sessionManager.getSession(sessionId);
            if (session) {
                await sessionManager.sendInterrupt(session);
            }
        });
        await Promise.all(promises);
    }
    /**
     * End a swarm (close all sessions)
     */
    async endSwarm(swarmId) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        let count = 0;
        for (const sessionId of swarm.sessionIds) {
            try {
                await sessionManager.endSession(sessionId);
                count++;
            }
            catch (err) {
                console.error(`[swarm] Failed to end session ${sessionId}:`, err);
            }
        }
        this.swarms.delete(swarmId);
        return count;
    }
    /**
     * End all swarms
     */
    async endAllSwarms() {
        let totalCount = 0;
        const swarmIds = Array.from(this.swarms.keys());
        for (const swarmId of swarmIds) {
            const count = await this.endSwarm(swarmId);
            totalCount += count;
        }
        return totalCount;
    }
    /**
     * Get swarm status summary
     */
    getSwarmStatus(swarmId) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            return { total: 0, connected: 0, disconnected: 0, failed: 0 };
        }
        let connected = 0;
        let disconnected = 0;
        for (const sessionId of swarm.sessionIds) {
            const session = sessionManager.getSession(sessionId);
            if (session?.connected) {
                connected++;
            }
            else {
                disconnected++;
            }
        }
        return {
            total: swarm.targets.length,
            connected,
            disconnected,
            failed: swarm.failedTargets.length,
        };
    }
    /**
     * Add a target to an existing swarm
     */
    async addTargetToSwarm(swarmId, target, options = {}) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        try {
            const session = await this.startSessionForTarget(swarm.method, target, options);
            swarm.targets.push(target);
            swarm.sessionIds.push(session.id);
            // Update status if it was failed
            if (swarm.status === "failed") {
                swarm.status = swarm.failedTargets.length > 0 ? "partial" : "active";
            }
            return true;
        }
        catch (error) {
            swarm.failedTargets.push(target.id);
            return false;
        }
    }
    /**
     * Remove a target from a swarm
     */
    async removeTargetFromSwarm(swarmId, targetId) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        // Find the target index
        const targetIdx = swarm.targets.findIndex(t => t.id === targetId);
        if (targetIdx === -1) {
            return false;
        }
        // Find corresponding session
        const successfulTargets = swarm.targets.filter(t => !swarm.failedTargets.includes(t.id));
        const sessionIdx = successfulTargets.findIndex(t => t.id === targetId);
        if (sessionIdx !== -1 && sessionIdx < swarm.sessionIds.length) {
            const sessionId = swarm.sessionIds[sessionIdx];
            await sessionManager.endSession(sessionId);
            swarm.sessionIds.splice(sessionIdx, 1);
        }
        // Remove from targets
        swarm.targets.splice(targetIdx, 1);
        // Remove from failed if present
        const failedIdx = swarm.failedTargets.indexOf(targetId);
        if (failedIdx !== -1) {
            swarm.failedTargets.splice(failedIdx, 1);
        }
        // Update status
        if (swarm.sessionIds.length === 0) {
            swarm.status = "failed";
        }
        else if (swarm.failedTargets.length > 0) {
            swarm.status = "partial";
        }
        else {
            swarm.status = "active";
        }
        return true;
    }
}
// Singleton instance
export const swarmManager = new SwarmManager();
//# sourceMappingURL=swarm.js.map