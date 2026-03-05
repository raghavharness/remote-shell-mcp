#!/usr/bin/env node

/**
 * Test runner for all integration tests
 *
 * Usage:
 *   npx ts-node src/tests/run-all.ts
 *   npx ts-node src/tests/run-all.ts --live  # Run with live SSH tests
 *
 * Environment variables for live tests:
 *   TEST_SSH_HOST - SSH host to connect to
 *   TEST_SSH_USER - SSH username
 *   TEST_SSH_KEY  - Path to SSH key (optional)
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestSuite {
  name: string;
  file: string;
}

const testSuites: TestSuite[] = [
  { name: "Session Management", file: "integration/session.test.ts" },
  { name: "File Transfer", file: "integration/file-transfer.test.ts" },
  { name: "Port Forwarding", file: "integration/port-forward.test.ts" },
];

async function runTestSuite(suite: TestSuite): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    const testPath = join(__dirname, suite.file);

    const proc = spawn("npx", ["ts-node", "--esm", testPath], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });

    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    proc.on("close", (code) => {
      resolve({ passed: code === 0, output });
    });

    proc.on("error", (err) => {
      resolve({ passed: false, output: err.message });
    });
  });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     Remote Shell MCP - Integration Test Suite    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const isLive = process.argv.includes("--live");

  if (isLive) {
    if (!process.env.TEST_SSH_HOST || !process.env.TEST_SSH_USER) {
      console.error("Error: Live tests require TEST_SSH_HOST and TEST_SSH_USER environment variables");
      process.exit(1);
    }
    console.log(`Running LIVE tests against: ${process.env.TEST_SSH_USER}@${process.env.TEST_SSH_HOST}\n`);
  } else {
    console.log("Running LOCAL tests only (use --live for SSH tests)\n");
  }

  const results: Array<{ suite: string; passed: boolean }> = [];

  for (const suite of testSuites) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Running: ${suite.name}`);
    console.log(`${"─".repeat(50)}\n`);

    const result = await runTestSuite(suite);
    results.push({ suite: suite.name, passed: result.passed });

    if (!result.passed) {
      console.log(`\n⚠ ${suite.name} had failures`);
    }
  }

  // Summary
  console.log(`\n${"═".repeat(50)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(50)}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const color = result.passed ? "\x1b[32m" : "\x1b[31m";
    console.log(`${color}${icon}\x1b[0m ${result.suite}`);
  }

  console.log(`\nTotal: ${passed}/${results.length} test suites passed`);

  if (failed > 0) {
    console.log("\nSome tests failed. Check output above for details.");
    process.exit(1);
  }

  console.log("\nAll tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
