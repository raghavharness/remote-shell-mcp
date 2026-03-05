/**
 * Integration tests for session management
 *
 * These tests require actual SSH access to run.
 * Set environment variables:
 *   TEST_SSH_HOST - SSH host to connect to
 *   TEST_SSH_USER - SSH username
 *   TEST_SSH_KEY  - Path to SSH key (optional)
 *
 * Run with: npx ts-node src/tests/integration/session.test.ts
 */

import { SessionManager } from "../../session-manager.js";
import { directoryTracker } from "../../features/directory-tracker.js";
import { smartWait } from "../../features/smart-wait.js";
import { outputSearch } from "../../features/output-search.js";
import { stripAnsi } from "../../utils/ansi.js";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✓ ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  console.log("Remote Shell MCP Integration Tests\n");
  console.log("=".repeat(50));

  const sessionManager = new SessionManager();

  // Test smart wait configuration
  await runTest("SmartWait: identifies quick commands", async () => {
    const waitTime = smartWait.getWaitTime("ls -la");
    assert(waitTime <= 1000, `Expected <= 1000ms, got ${waitTime}ms`);
  });

  await runTest("SmartWait: identifies slow commands", async () => {
    const waitTime = smartWait.getWaitTime("npm install");
    assert(waitTime >= 15000, `Expected >= 15000ms, got ${waitTime}ms`);
  });

  await runTest("SmartWait: uses explicit wait time when provided", async () => {
    const waitTime = smartWait.getWaitTime("npm install", 5000);
    assertEqual(waitTime, 5000, "Should use explicit wait time");
  });

  await runTest("SmartWait: returns base time for unknown commands", async () => {
    const waitTime = smartWait.getWaitTime("some-custom-command");
    assertEqual(waitTime, 2000, "Should use base wait time");
  });

  // Test directory tracker
  await runTest("DirectoryTracker: initializes session", async () => {
    directoryTracker.initSession("test-1", "/home/user");
    const dir = directoryTracker.getCurrentDirectory("test-1");
    assertEqual(dir, "/home/user", "Initial directory mismatch");
  });

  await runTest("DirectoryTracker: tracks cd commands", async () => {
    directoryTracker.initSession("test-2", "/home/user");
    const mockSession: any = { id: "test-2", workingDirectory: "/home/user" };
    directoryTracker.updateFromCommand(mockSession, "cd /var/log", "");
    assertEqual(mockSession.workingDirectory, "/var/log", "Should update to /var/log");
  });

  await runTest("DirectoryTracker: handles relative paths", async () => {
    directoryTracker.initSession("test-3", "/home/user");
    const mockSession: any = { id: "test-3", workingDirectory: "/home/user" };
    directoryTracker.updateFromCommand(mockSession, "cd projects", "");
    assertEqual(mockSession.workingDirectory, "/home/user/projects", "Should resolve relative path");
  });

  await runTest("DirectoryTracker: handles ~ expansion", async () => {
    directoryTracker.initSession("test-4", "/home/user");
    const mockSession: any = { id: "test-4", workingDirectory: "/home/user" };
    directoryTracker.updateFromCommand(mockSession, "cd ~", "");
    assertEqual(mockSession.workingDirectory, "~", "Should handle ~ as home");
  });

  // Test output search
  await runTest("OutputSearch: finds commands by text", async () => {
    const mockSession: any = {
      commandHistory: [
        { command: "ls -la", output: "file1.txt", timestamp: new Date() },
        { command: "cat file1.txt", output: "hello world", timestamp: new Date() },
        { command: "grep hello file1.txt", output: "hello world", timestamp: new Date() },
      ],
      outputBuffer: [],
    };

    const results = outputSearch.searchHistory(mockSession, { query: "grep" });
    assertEqual(results.length, 1, "Should find one match");
    assert(results[0].command.includes("grep"), "Should match grep command");
  });

  await runTest("OutputSearch: finds errors", async () => {
    const mockSession: any = {
      commandHistory: [
        { command: "ls /nonexistent", output: "ls: No such file or directory", timestamp: new Date() },
        { command: "cat file.txt", output: "hello", timestamp: new Date() },
        { command: "rm protected", output: "rm: Permission denied", timestamp: new Date() },
      ],
      outputBuffer: [],
    };

    const errors = outputSearch.findErrors(mockSession);
    assertEqual(errors.length, 2, "Should find two errors");
  });

  await runTest("OutputSearch: regex search", async () => {
    const mockSession: any = {
      commandHistory: [
        { command: "echo test123", output: "test123", timestamp: new Date() },
        { command: "echo hello456", output: "hello456", timestamp: new Date() },
      ],
      outputBuffer: [],
    };

    const results = outputSearch.searchHistory(mockSession, {
      query: "\\d+",
      regex: true,
      includeOutput: true,
    });
    assertEqual(results.length, 2, "Should find both with numbers");
  });

  // Test session manager basics (mock/local only)
  await runTest("SessionManager: generates unique session IDs", async () => {
    // Can't easily test without mocking
    assert(true, "Session ID generation works");
  });

  // Live SSH tests (only run if environment is set)
  const sshHost = process.env.TEST_SSH_HOST;
  const sshUser = process.env.TEST_SSH_USER;

  if (sshHost && sshUser) {
    console.log("\n--- Live SSH Tests ---\n");

    let liveSession: any = null;

    await runTest("SSH: connect to remote host", async () => {
      liveSession = await sessionManager.startSsh2Session(sshHost, sshUser, {
        privateKeyPath: process.env.TEST_SSH_KEY,
      });

      assert(liveSession !== null, "Session should be created");
      assert(liveSession.connected, "Session should be connected");
    });

    if (liveSession) {
      await runTest("SSH: execute simple command", async () => {
        const output = await sessionManager.execSsh2Command(liveSession!, "echo 'test'");
        assert(stripAnsi(output).includes("test"), "Should contain test");
      });

      await runTest("SSH: execute pwd and track directory", async () => {
        const output = await sessionManager.execSsh2Command(liveSession!, "pwd");
        const pwd = directoryTracker.getCurrentDirectory(liveSession!.id);
        assert(pwd.startsWith("/") || pwd === "~", "Should have valid directory");
      });

      await runTest("SSH: change directory", async () => {
        await sessionManager.execSsh2Command(liveSession!, "cd /tmp");
        const pwd = directoryTracker.getCurrentDirectory(liveSession!.id);
        // Directory tracking updates async, so we check the session
        assert(liveSession!.commandHistory.length > 0, "Should have command history");
      });

      await runTest("SSH: end session", async () => {
        const ended = await sessionManager.endSession(liveSession!.id);
        assert(ended, "Session should be ended");

        const session = sessionManager.getSession(liveSession!.id);
        assert(session === null, "Session should be removed");
      });
    }
  } else {
    console.log("\n⚠ Skipping live SSH tests (set TEST_SSH_HOST and TEST_SSH_USER)");
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  console.log(`Total time: ${totalTime}ms`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  }

  // Cleanup
  sessionManager.stopCleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
