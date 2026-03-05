import { ShellSession, FileTransferOptions } from "../types.js";
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
export declare class FileTransfer {
    /**
     * Upload a file to the remote session
     */
    upload(session: ShellSession, options: FileTransferOptions): Promise<TransferResult>;
    /**
     * Download a file from the remote session
     */
    download(session: ShellSession, options: FileTransferOptions): Promise<TransferResult>;
    /**
     * Upload via SFTP (SSH2 sessions)
     */
    private uploadViaSftp;
    /**
     * Download via SFTP (SSH2 sessions)
     */
    private downloadViaSftp;
    /**
     * Upload via SCP for child_process sessions
     * Uses base64 encoding through the shell
     */
    private uploadViaScp;
    /**
     * Download via base64 encoding through shell
     */
    private downloadViaScp;
    /**
     * List remote directory
     */
    listRemote(session: ShellSession, remotePath: string): Promise<string[]>;
    private listViaSftp;
    private sleep;
}
export declare const fileTransfer: FileTransfer;
//# sourceMappingURL=file-transfer.d.ts.map