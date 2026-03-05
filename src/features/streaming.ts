import { ShellSession } from "../types.js";
import { EventEmitter } from "events";

export interface StreamingOutput {
  sessionId: string;
  data: string;
  timestamp: Date;
  isError: boolean;
}

export class OutputStreamer extends EventEmitter {
  private activeStreams: Map<string, Set<(output: StreamingOutput) => void>> = new Map();

  /**
   * Register a listener for streaming output
   */
  subscribe(
    session: ShellSession,
    callback: (output: StreamingOutput) => void
  ): () => void {
    const sessionId = session.id;

    // Add to our tracking
    if (!this.activeStreams.has(sessionId)) {
      this.activeStreams.set(sessionId, new Set());
    }
    this.activeStreams.get(sessionId)!.add(callback);

    // Add to session's listeners
    const internalCallback = (data: string) => {
      callback({
        sessionId,
        data,
        timestamp: new Date(),
        isError: false,
      });
    };

    session.outputListeners.add(internalCallback);

    // Return unsubscribe function
    return () => {
      session.outputListeners.delete(internalCallback);
      const streams = this.activeStreams.get(sessionId);
      if (streams) {
        streams.delete(callback);
        if (streams.size === 0) {
          this.activeStreams.delete(sessionId);
        }
      }
    };
  }

  /**
   * Get pending output that hasn't been streamed yet
   */
  getPendingOutput(session: ShellSession): string {
    const pending = session.pendingOutput;
    session.pendingOutput = "";
    return pending;
  }

  /**
   * Check if a session has active stream listeners
   */
  hasListeners(sessionId: string): boolean {
    const streams = this.activeStreams.get(sessionId);
    return streams ? streams.size > 0 : false;
  }

  /**
   * Get number of active listeners for a session
   */
  getListenerCount(sessionId: string): number {
    const streams = this.activeStreams.get(sessionId);
    return streams ? streams.size : 0;
  }

  /**
   * Remove all listeners for a session
   */
  clearSessionListeners(session: ShellSession): void {
    session.outputListeners.clear();
    this.activeStreams.delete(session.id);
  }

  /**
   * Broadcast output to all listeners
   */
  broadcast(session: ShellSession, data: string, isError: boolean = false): void {
    const output: StreamingOutput = {
      sessionId: session.id,
      data,
      timestamp: new Date(),
      isError,
    };

    // Emit event
    this.emit("output", output);

    // Call all registered callbacks
    for (const listener of session.outputListeners) {
      try {
        listener(data);
      } catch (err) {
        console.error("[remote-shell] Output listener error:", err);
      }
    }
  }
}

// Singleton instance
export const outputStreamer = new OutputStreamer();

/**
 * Async generator for streaming output
 */
export async function* streamOutput(
  session: ShellSession,
  options: {
    timeout?: number;
    bufferSize?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const { timeout = 30000, bufferSize = 1000 } = options;

  const buffer: string[] = [];
  let done = false;
  let resolver: (() => void) | null = null;

  const callback = (data: string) => {
    buffer.push(data);

    // Trim buffer if too large
    if (buffer.length > bufferSize) {
      buffer.splice(0, buffer.length - bufferSize);
    }

    // Wake up the generator
    if (resolver) {
      resolver();
      resolver = null;
    }
  };

  session.outputListeners.add(callback);

  const startTime = Date.now();

  try {
    while (!done && Date.now() - startTime < timeout) {
      // Yield any buffered data
      while (buffer.length > 0) {
        yield buffer.shift()!;
      }

      // Wait for new data or timeout
      await new Promise<void>((resolve) => {
        resolver = resolve;
        setTimeout(resolve, 100); // Poll every 100ms
      });

      // Check if session is still connected
      if (!session.connected) {
        done = true;
      }
    }
  } finally {
    session.outputListeners.delete(callback);
  }
}

/**
 * Collect output for a specified duration
 */
export async function collectOutput(
  session: ShellSession,
  durationMs: number
): Promise<string> {
  const output: string[] = [];

  const callback = (data: string) => {
    output.push(data);
  };

  session.outputListeners.add(callback);

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  session.outputListeners.delete(callback);

  return output.join("");
}

/**
 * Wait for a specific pattern in output
 */
export async function waitForPattern(
  session: ShellSession,
  pattern: RegExp | string,
  options: {
    timeout?: number;
    includeMatch?: boolean;
  } = {}
): Promise<string> {
  const { timeout = 30000, includeMatch = true } = options;
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

  return new Promise((resolve, reject) => {
    const output: string[] = [];
    const startTime = Date.now();

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for pattern: ${pattern}`));
    }, timeout);

    const callback = (data: string) => {
      output.push(data);
      const fullOutput = output.join("");

      const match = fullOutput.match(regex);
      if (match) {
        clearTimeout(timeoutId);
        cleanup();

        if (includeMatch) {
          resolve(fullOutput);
        } else {
          // Return output up to (not including) the match
          const matchIndex = fullOutput.indexOf(match[0]);
          resolve(fullOutput.substring(0, matchIndex));
        }
      }
    };

    const cleanup = () => {
      session.outputListeners.delete(callback);
    };

    session.outputListeners.add(callback);
  });
}
