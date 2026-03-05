/**
 * Integration tests for file transfer
 *
 * These tests require actual SSH access to run.
 * Set environment variables:
 *   TEST_SSH_HOST - SSH host to connect to
 *   TEST_SSH_USER - SSH username
 *   TEST_SSH_KEY  - Path to SSH key (optional)
 *
 * Run with: npx ts-node src/tests/integration/file-transfer.test.ts
 */

import { SessionManager } from "../../session-manager.js";
import { fileTransfer } from "../../features/file-transfer.js";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const tempFiles: string[] = [];

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

function createTempFile(content: string): string {
  const path = join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(path, content);
  tempFiles.push(path);
  return path;
}

function cleanup(): void {
  for (const file of tempFiles) {
    try {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    } catch {}
  }
}

async function main() {
  console.log("File Transfer Integration Tests\n");
  console.log("=".repeat(50));

  const sessionManager = new SessionManager();
  const sshHost = process.env.TEST_SSH_HOST;
  const sshUser = process.env.TEST_SSH_USER;

  // Local tests
  await runTest("FileTransfer: rejects non-existent local file", async () => {
    const mockSession: any = {
      type: "child_process",
      childProcess: null,
    };

    const result = await fileTransfer.upload(mockSession, {
      localPath: "/nonexistent/file.txt",
      remotePath: "/tmp/file.txt",
    });

    assert(!result.success, "Should fail for non-existent file");
    assert(result.error !== undefined, "Should have error message");
  });

  await runTest("FileTransfer: rejects when no session", async () => {
    const mockSession: any = {
      type: "child_process",
      childProcess: null,
    };

    const localFile = createTempFile("test content");

    const result = await fileTransfer.upload(mockSession, {
      localPath: localFile,
      remotePath: "/tmp/test.txt",
    });

    assert(!result.success, "Should fail without active session");
  });

  // Live SSH tests
  if (sshHost && sshUser) {
    console.log("\n--- Live SSH Tests ---\n");

    let session: any = null;

    await runTest("Setup: connect to remote host", async () => {
      session = await sessionManager.startSsh2Session(sshHost, sshUser, {
        privateKeyPath: process.env.TEST_SSH_KEY,
      });

      assert(session !== null, "Session should be created");
      assert(session.connected, "Session should be connected");
    });

    if (session) {
      const testContent = `Test file content ${Date.now()}`;
      const remoteTestFile = `/tmp/mcp-test-${Date.now()}.txt`;
      const localDownloadPath = join(tmpdir(), `mcp-download-${Date.now()}.txt`);
      tempFiles.push(localDownloadPath);

      await runTest("SFTP: upload text file", async () => {
        const localFile = createTempFile(testContent);

        const result = await fileTransfer.upload(session!, {
          localPath: localFile,
          remotePath: remoteTestFile,
        });

        assert(result.success, `Upload failed: ${result.error}`);
        assert(result.bytesTransferred > 0, "Should transfer bytes");
      });

      await runTest("SFTP: download text file", async () => {
        const result = await fileTransfer.download(session!, {
          localPath: localDownloadPath,
          remotePath: remoteTestFile,
        });

        assert(result.success, `Download failed: ${result.error}`);
        assert(result.bytesTransferred > 0, "Should transfer bytes");

        const downloadedContent = readFileSync(localDownloadPath, "utf-8");
        assert(downloadedContent === testContent, "Content should match");
      });

      await runTest("SFTP: list remote directory", async () => {
        const files = await fileTransfer.listRemote(session!, "/tmp");

        assert(Array.isArray(files), "Should return array");
        assert(files.length > 0, "Should have files in /tmp");
      });

      await runTest("SFTP: upload binary file", async () => {
        // Create a binary file
        const binaryPath = join(tmpdir(), `binary-${Date.now()}.bin`);
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
        writeFileSync(binaryPath, binaryContent);
        tempFiles.push(binaryPath);

        const remoteBinaryPath = `/tmp/mcp-binary-${Date.now()}.bin`;

        const result = await fileTransfer.upload(session!, {
          localPath: binaryPath,
          remotePath: remoteBinaryPath,
        });

        assert(result.success, `Binary upload failed: ${result.error}`);

        // Clean up remote file
        await sessionManager.execSsh2Command(session!, `rm -f ${remoteBinaryPath}`);
      });

      await runTest("SFTP: handle missing remote file", async () => {
        const result = await fileTransfer.download(session!, {
          localPath: join(tmpdir(), "nonexistent.txt"),
          remotePath: "/nonexistent/path/file.txt",
        });

        assert(!result.success, "Should fail for missing file");
      });

      // Cleanup remote test file
      await runTest("Cleanup: remove remote test file", async () => {
        await sessionManager.execSsh2Command(session!, `rm -f ${remoteTestFile}`);
        assert(true, "Cleanup complete");
      });

      await runTest("Teardown: end session", async () => {
        await sessionManager.endSession(session!.id);
        assert(true, "Session ended");
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
  }

  // Cleanup
  cleanup();
  sessionManager.stopCleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  cleanup();
  process.exit(1);
});
