import { OutputBlock, BlockSearchOptions, BlockSearchResult } from "../types.js";
/**
 * Block Manager - Warp-style block-based output management
 *
 * Each command+output becomes a "block" that can be:
 * - Referenced by ID
 * - Searched
 * - Tagged
 * - Collapsed/expanded
 * - Copied (output only)
 */
export declare class BlockManager {
    private blocks;
    private sessionBlocks;
    private blockCounter;
    private maxBlocksPerSession;
    /**
     * Create a new block for a command execution
     */
    createBlock(sessionId: string, command: string, workingDirectory: string): OutputBlock;
    /**
     * Complete a block with output
     */
    completeBlock(blockId: string, output: string, exitCode?: number, isError?: boolean): OutputBlock | null;
    /**
     * Get a specific block
     */
    getBlock(blockId: string): OutputBlock | null;
    /**
     * Get all blocks for a session
     */
    getSessionBlocks(sessionId: string, limit?: number): OutputBlock[];
    /**
     * Get recent blocks across all sessions
     */
    getRecentBlocks(limit?: number): OutputBlock[];
    /**
     * Search blocks
     */
    searchBlocks(options: BlockSearchOptions): BlockSearchResult[];
    /**
     * Tag a block
     */
    tagBlock(blockId: string, tags: string[]): boolean;
    /**
     * Remove tags from a block
     */
    untagBlock(blockId: string, tags: string[]): boolean;
    /**
     * Toggle block collapsed state
     */
    toggleCollapsed(blockId: string): boolean;
    /**
     * Set block collapsed state
     */
    setCollapsed(blockId: string, collapsed: boolean): boolean;
    /**
     * Get output only (for copy)
     */
    getBlockOutput(blockId: string, stripAnsiCodes?: boolean): string | null;
    /**
     * Find error blocks
     */
    findErrorBlocks(sessionId?: string): OutputBlock[];
    /**
     * Get blocks by tag
     */
    getBlocksByTag(tag: string, sessionId?: string): OutputBlock[];
    /**
     * Clean up blocks for a session
     */
    clearSessionBlocks(sessionId: string): number;
    /**
     * Get block count
     */
    getBlockCount(sessionId?: string): number;
    /**
     * Get the last block for a session
     */
    getLastBlock(sessionId: string): OutputBlock | null;
}
export declare const blockManager: BlockManager;
//# sourceMappingURL=blocks.d.ts.map