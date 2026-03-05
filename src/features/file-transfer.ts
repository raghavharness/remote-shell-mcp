import { ShellSession, FileTransferOptions } from "../types.js";
import { spawn, ChildProcess } from "child_process";
import { Client, SFTPWrapper } from "ssh2";
import { createReadStream, createWriteStream, statSync, existsSync } from "fs";
import { basename, dirname, join } from "path";
import { homedir } from "os";
import { stripAnsi } from "../utils/ansi.js";

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  filename: string;
}

export interface TransferResult {
  success: boolean;
  localPath: string;
  remotePath: string;
  bytesTransferred: number;
  duration: number;
  error?: string;
}

export class FileTransfer {
  /**
   * Upload a file to the remote session
   */
  async upload(session: ShellSession, options: FileTransferOptions): Promise<TransferResult> {
    const startTime = Date.now();
    const localPath = options.localPath.replace(/^~/, homedir());

    if (!existsSync(localPath)) {
      return {
        success: false,
        localPath: options.localPath,
        remotePath: options.remotePath,
        bytesTransferred: 0,
        duration: 0,
        error: `Local file not found: ${localPath}`,
      };
    }

    try {
      if (session.type === "ssh2" && session.sshClient) {
        return await this.uploadViaSftp(session.sshClient, localPath, options.remotePath, startTime);
      } else if (session.type === "child_process") {
        return await this.uploadViaScp(session, localPath, options.remotePath, startTime);
      }

      return {
        success: false,
        localPath: options.localPath,
        remotePath: options.remotePath,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
        error: "Unsupported session type for file transfer",
      };
    } catch (error: any) {
      return {
        success: false,
        localPath: options.localPath,
        remotePath: options.remotePath,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
        error: error.message || String(error),
      };
    }
  }

  /**
   * Download a file from the remote session
   */
  async download(session: ShellSession, options: FileTransferOptions): Promise<TransferResult> {
    const startTime = Date.now();
    const localPath = options.localPath.replace(/^~/, homedir());

    try {
      if (session.type === "ssh2" && session.sshClient) {
        return await this.downloadViaSftp(session.sshClient, options.remotePath, localPath, startTime);
      } else if (session.type === "child_process") {
        return await this.downloadViaScp(session, options.remotePath, localPath, startTime);
      }

      return {
        success: false,
        localPath: options.localPath,
        remotePath: options.remotePath,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
        error: "Unsupported session type for file transfer",
      };
    } catch (error: any) {
      return {
        success: false,
        localPath: options.localPath,
        remotePath: options.remotePath,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
        error: error.message || String(error),
      };
    }
  }

  /**
   * Upload via SFTP (SSH2 sessions)
   */
  private async uploadViaSftp(
    client: Client,
    localPath: string,
    remotePath: string,
    startTime: number
  ): Promise<TransferResult> {
    return new Promise((resolve) => {
      client.sftp((err, sftp) => {
        if (err) {
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred: 0,
            duration: Date.now() - startTime,
            error: `SFTP error: ${err.message}`,
          });
          return;
        }

        const readStream = createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);

        let bytesTransferred = 0;

        readStream.on("data", (chunk: string | Buffer) => {
          bytesTransferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
        });

        writeStream.on("close", () => {
          sftp.end();
          resolve({
            success: true,
            localPath,
            remotePath,
            bytesTransferred,
            duration: Date.now() - startTime,
          });
        });

        writeStream.on("error", (error: Error) => {
          sftp.end();
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred,
            duration: Date.now() - startTime,
            error: error.message,
          });
        });

        readStream.pipe(writeStream);
      });
    });
  }

  /**
   * Download via SFTP (SSH2 sessions)
   */
  private async downloadViaSftp(
    client: Client,
    remotePath: string,
    localPath: string,
    startTime: number
  ): Promise<TransferResult> {
    return new Promise((resolve) => {
      client.sftp((err, sftp) => {
        if (err) {
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred: 0,
            duration: Date.now() - startTime,
            error: `SFTP error: ${err.message}`,
          });
          return;
        }

        const readStream = sftp.createReadStream(remotePath);
        const writeStream = createWriteStream(localPath);

        let bytesTransferred = 0;

        readStream.on("data", (chunk: string | Buffer) => {
          bytesTransferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
        });

        writeStream.on("close", () => {
          sftp.end();
          resolve({
            success: true,
            localPath,
            remotePath,
            bytesTransferred,
            duration: Date.now() - startTime,
          });
        });

        readStream.on("error", (error: Error) => {
          sftp.end();
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred,
            duration: Date.now() - startTime,
            error: error.message,
          });
        });

        readStream.pipe(writeStream);
      });
    });
  }

  /**
   * Upload via SCP for child_process sessions
   * Uses base64 encoding through the shell
   */
  private async uploadViaScp(
    session: ShellSession,
    localPath: string,
    remotePath: string,
    startTime: number
  ): Promise<TransferResult> {
    return new Promise(async (resolve) => {
      if (!session.childProcess || !session.childProcess.stdin) {
        resolve({
          success: false,
          localPath,
          remotePath,
          bytesTransferred: 0,
          duration: Date.now() - startTime,
          error: "No active session",
        });
        return;
      }

      try {
        const { readFileSync } = await import("fs");
        const fileContent = readFileSync(localPath);
        const base64Content = fileContent.toString("base64");
        const bytesTransferred = fileContent.length;

        // Use base64 encoding to transfer through the shell
        // This works even for binary files
        const command = `echo '${base64Content}' | base64 -d > ${remotePath}`;

        session.outputBuffer = [];
        session.childProcess.stdin.write(command + "\n");

        // Wait for command to complete
        await this.sleep(2000);

        // Verify the file was created
        session.outputBuffer = [];
        session.childProcess.stdin.write(`ls -la ${remotePath} 2>/dev/null && echo "TRANSFER_SUCCESS" || echo "TRANSFER_FAILED"\n`);

        await this.sleep(1000);

        const output = session.outputBuffer.join("");
        const success = output.includes("TRANSFER_SUCCESS");

        resolve({
          success,
          localPath,
          remotePath,
          bytesTransferred: success ? bytesTransferred : 0,
          duration: Date.now() - startTime,
          error: success ? undefined : "Failed to write file on remote",
        });
      } catch (error: any) {
        resolve({
          success: false,
          localPath,
          remotePath,
          bytesTransferred: 0,
          duration: Date.now() - startTime,
          error: error.message,
        });
      }
    });
  }

  /**
   * Download via base64 encoding through shell
   */
  private async downloadViaScp(
    session: ShellSession,
    remotePath: string,
    localPath: string,
    startTime: number
  ): Promise<TransferResult> {
    return new Promise(async (resolve) => {
      if (!session.childProcess || !session.childProcess.stdin) {
        resolve({
          success: false,
          localPath,
          remotePath,
          bytesTransferred: 0,
          duration: Date.now() - startTime,
          error: "No active session",
        });
        return;
      }

      try {
        // Get base64 encoded content from remote
        session.outputBuffer = [];
        const command = `base64 ${remotePath} 2>/dev/null && echo "\n___BASE64_END___" || echo "___BASE64_ERROR___"`;
        session.childProcess.stdin.write(command + "\n");

        // Wait for output
        await this.sleep(5000);

        const output = stripAnsi(session.outputBuffer.join(""));

        if (output.includes("___BASE64_ERROR___")) {
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred: 0,
            duration: Date.now() - startTime,
            error: "Failed to read remote file",
          });
          return;
        }

        // Extract base64 content
        const endMarker = output.indexOf("___BASE64_END___");
        if (endMarker === -1) {
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred: 0,
            duration: Date.now() - startTime,
            error: "Transfer incomplete",
          });
          return;
        }

        // Clean up the base64 content
        let base64Content = output.substring(0, endMarker)
          .replace(/^.*?\n/, "") // Remove the command echo
          .replace(/\s/g, ""); // Remove whitespace

        // Decode and write
        const { writeFileSync } = await import("fs");
        const buffer = Buffer.from(base64Content, "base64");
        writeFileSync(localPath, buffer);

        resolve({
          success: true,
          localPath,
          remotePath,
          bytesTransferred: buffer.length,
          duration: Date.now() - startTime,
        });
      } catch (error: any) {
        resolve({
          success: false,
          localPath,
          remotePath,
          bytesTransferred: 0,
          duration: Date.now() - startTime,
          error: error.message,
        });
      }
    });
  }

  /**
   * List remote directory
   */
  async listRemote(session: ShellSession, remotePath: string): Promise<string[]> {
    // Check if session is connected
    if (!session.connected) {
      console.error("[remote-shell] listRemote: Session not connected");
      return [];
    }

    if (session.type === "ssh2" && session.sshClient) {
      return this.listViaSftp(session.sshClient, remotePath);
    } else if (session.type === "child_process" && session.childProcess?.stdin) {
      // Verify process is still running
      if (session.childProcess.exitCode !== null || session.childProcess.killed) {
        session.connected = false;
        return [];
      }

      session.outputBuffer = [];
      session.childProcess.stdin.write(`ls -la ${remotePath}\n`);
      await this.sleep(2000);
      return stripAnsi(session.outputBuffer.join("")).split("\n").filter(l => l.trim());
    }
    return [];
  }

  private async listViaSftp(client: Client, remotePath: string): Promise<string[]> {
    return new Promise((resolve) => {
      client.sftp((err, sftp) => {
        if (err) {
          resolve([]);
          return;
        }

        sftp.readdir(remotePath, (err, list) => {
          sftp.end();
          if (err) {
            resolve([]);
            return;
          }
          resolve(list.map(f => `${f.longname}`));
        });
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const fileTransfer = new FileTransfer();
