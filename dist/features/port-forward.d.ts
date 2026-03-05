import { ShellSession, PortForward, PortForwardOptions } from "../types.js";
export declare class PortForwarder {
    private activeForwards;
    private forwardCounter;
    /**
     * Start a local port forward (local -> remote)
     * Listens on local port, forwards to remote host:port
     */
    startLocalForward(session: ShellSession, options: PortForwardOptions): Promise<PortForward>;
    /**
     * Start a remote port forward (remote -> local)
     * Listens on remote port, forwards to local host:port
     */
    startRemoteForward(session: ShellSession, options: PortForwardOptions): Promise<PortForward>;
    /**
     * Start a dynamic (SOCKS) forward
     */
    startDynamicForward(session: ShellSession, localPort: number): Promise<PortForward>;
    /**
     * Stop a port forward
     */
    stopForward(session: ShellSession, forwardId: string): Promise<boolean>;
    /**
     * Stop all forwards for a session
     */
    stopAllForwards(session: ShellSession): Promise<number>;
    /**
     * List active forwards
     */
    listForwards(session: ShellSession): PortForward[];
    /**
     * SSH2 local port forward implementation
     */
    private startSsh2LocalForward;
    /**
     * SSH2 remote port forward implementation
     */
    private startSsh2RemoteForward;
    /**
     * Shell-based local port forward (using ssh -L in background)
     */
    private startShellLocalForward;
    /**
     * Parse SSH command to extract connection details
     */
    private parseSshCommand;
}
export declare const portForwarder: PortForwarder;
//# sourceMappingURL=port-forward.d.ts.map