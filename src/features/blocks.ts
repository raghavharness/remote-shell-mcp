import { OutputBlock, BlockSearchOptions, BlockSearchResult } from "../types.js";
import { stripAnsi } from "../utils/ansi.js";

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
export class BlockManager {
  private blocks: Map<string, OutputBlock> = new Map();
  private sessionBlocks: Map<string, string[]> = new Map(); // sessionId -> blockIds
  private blockCounter = 0;
  private maxBlocksPerSession = 100;

  /**
   * Create a new block for a command execution
   */
  createBlock(
    sessionId: string,
    command: string,
    workingDirectory: string
  ): OutputBlock {
    const blockId = `block-${++this.blockCounter}`;

    const block: OutputBlock = {
      id: blockId,
      sessionId,
      command,
      output: "",
      startedAt: new Date(),
      completedAt: new Date(),
      workingDirectory,
      collapsed: false,
      tags: [],
      isError: false,
    };

    this.blocks.set(blockId, block);

    // Track by session
    if (!this.sessionBlocks.has(sessionId)) {
      this.sessionBlocks.set(sessionId, []);
    }
    const sessionBlockList = this.sessionBlocks.get(sessionId)!;
    sessionBlockList.push(blockId);

    // Trim old blocks if over limit
    if (sessionBlockList.length > this.maxBlocksPerSession) {
      const oldBlockId = sessionBlockList.shift()!;
      this.blocks.delete(oldBlockId);
    }

    return block;
  }

  /**
   * Complete a block with output
   */
  completeBlock(
    blockId: string,
    output: string,
    exitCode?: number,
    isError: boolean = false
  ): OutputBlock | null {
    const block = this.blocks.get(blockId);
    if (!block) return null;

    block.output = output;
    block.exitCode = exitCode;
    block.completedAt = new Date();
    block.isError = isError;

    return block;
  }

  /**
   * Get a specific block
   */
  getBlock(blockId: string): OutputBlock | null {
    return this.blocks.get(blockId) || null;
  }

  /**
   * Get all blocks for a session
   */
  getSessionBlocks(sessionId: string, limit?: number): OutputBlock[] {
    const blockIds = this.sessionBlocks.get(sessionId) || [];
    const blocks = blockIds
      .map(id => this.blocks.get(id))
      .filter((b): b is OutputBlock => b !== undefined);

    if (limit) {
      return blocks.slice(-limit);
    }
    return blocks;
  }

  /**
   * Get recent blocks across all sessions
   */
  getRecentBlocks(limit: number = 10): OutputBlock[] {
    const allBlocks = Array.from(this.blocks.values());
    return allBlocks
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Search blocks
   */
  searchBlocks(options: BlockSearchOptions): BlockSearchResult[] {
    const { sessionId, query, regex, caseSensitive, limit = 20, tags } = options;

    let blocksToSearch: OutputBlock[];
    if (sessionId) {
      blocksToSearch = this.getSessionBlocks(sessionId);
    } else {
      blocksToSearch = Array.from(this.blocks.values());
    }

    // Filter by tags if specified
    if (tags && tags.length > 0) {
      blocksToSearch = blocksToSearch.filter(block =>
        tags.some(tag => block.tags.includes(tag))
      );
    }

    const results: BlockSearchResult[] = [];
    const searchPattern = regex
      ? new RegExp(query, caseSensitive ? "" : "i")
      : null;
    const searchLower = caseSensitive ? query : query.toLowerCase();

    for (const block of blocksToSearch) {
      const textToSearch = `${block.command}\n${stripAnsi(block.output)}`;
      const textForMatch = caseSensitive ? textToSearch : textToSearch.toLowerCase();

      let matched = false;
      let matchedText = "";

      if (searchPattern) {
        const match = textToSearch.match(searchPattern);
        if (match) {
          matched = true;
          matchedText = match[0];
        }
      } else {
        const idx = textForMatch.indexOf(searchLower);
        if (idx !== -1) {
          matched = true;
          matchedText = textToSearch.substring(idx, idx + query.length);
        }
      }

      if (matched) {
        // Extract context around match
        const lines = textToSearch.split("\n");
        const matchLine = lines.find(line => {
          const lineToCheck = caseSensitive ? line : line.toLowerCase();
          return searchPattern
            ? searchPattern.test(line)
            : lineToCheck.includes(searchLower);
        });

        results.push({
          blockId: block.id,
          command: block.command,
          matchedText,
          timestamp: block.completedAt,
          context: matchLine?.trim().substring(0, 200),
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Tag a block
   */
  tagBlock(blockId: string, tags: string[]): boolean {
    const block = this.blocks.get(blockId);
    if (!block) return false;

    // Add new tags, avoid duplicates
    for (const tag of tags) {
      if (!block.tags.includes(tag)) {
        block.tags.push(tag);
      }
    }
    return true;
  }

  /**
   * Remove tags from a block
   */
  untagBlock(blockId: string, tags: string[]): boolean {
    const block = this.blocks.get(blockId);
    if (!block) return false;

    block.tags = block.tags.filter(t => !tags.includes(t));
    return true;
  }

  /**
   * Toggle block collapsed state
   */
  toggleCollapsed(blockId: string): boolean {
    const block = this.blocks.get(blockId);
    if (!block) return false;

    block.collapsed = !block.collapsed;
    return true;
  }

  /**
   * Set block collapsed state
   */
  setCollapsed(blockId: string, collapsed: boolean): boolean {
    const block = this.blocks.get(blockId);
    if (!block) return false;

    block.collapsed = collapsed;
    return true;
  }

  /**
   * Get output only (for copy)
   */
  getBlockOutput(blockId: string, stripAnsiCodes: boolean = true): string | null {
    const block = this.blocks.get(blockId);
    if (!block) return null;

    return stripAnsiCodes ? stripAnsi(block.output) : block.output;
  }

  /**
   * Find error blocks
   */
  findErrorBlocks(sessionId?: string): OutputBlock[] {
    let blocksToSearch: OutputBlock[];
    if (sessionId) {
      blocksToSearch = this.getSessionBlocks(sessionId);
    } else {
      blocksToSearch = Array.from(this.blocks.values());
    }

    return blocksToSearch.filter(block => block.isError);
  }

  /**
   * Get blocks by tag
   */
  getBlocksByTag(tag: string, sessionId?: string): OutputBlock[] {
    let blocksToSearch: OutputBlock[];
    if (sessionId) {
      blocksToSearch = this.getSessionBlocks(sessionId);
    } else {
      blocksToSearch = Array.from(this.blocks.values());
    }

    return blocksToSearch.filter(block => block.tags.includes(tag));
  }

  /**
   * Clean up blocks for a session
   */
  clearSessionBlocks(sessionId: string): number {
    const blockIds = this.sessionBlocks.get(sessionId) || [];
    for (const blockId of blockIds) {
      this.blocks.delete(blockId);
    }
    this.sessionBlocks.delete(sessionId);
    return blockIds.length;
  }

  /**
   * Get block count
   */
  getBlockCount(sessionId?: string): number {
    if (sessionId) {
      return this.sessionBlocks.get(sessionId)?.length || 0;
    }
    return this.blocks.size;
  }

  /**
   * Get the last block for a session
   */
  getLastBlock(sessionId: string): OutputBlock | null {
    const blockIds = this.sessionBlocks.get(sessionId);
    if (!blockIds || blockIds.length === 0) return null;

    const lastBlockId = blockIds[blockIds.length - 1];
    return this.blocks.get(lastBlockId) || null;
  }
}

// Singleton instance
export const blockManager = new BlockManager();
