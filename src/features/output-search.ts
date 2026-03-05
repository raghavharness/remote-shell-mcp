import { ShellSession, SearchOptions, SearchResult, CommandHistoryEntry } from "../types.js";
import { stripAnsi } from "../utils/ansi.js";

export class OutputSearch {
  /**
   * Search through command history
   */
  searchHistory(session: ShellSession, options: SearchOptions): SearchResult[] {
    const {
      query,
      regex = false,
      caseSensitive = false,
      limit = 50,
      includeOutput = false,
    } = options;

    const results: SearchResult[] = [];
    const searchPattern = this.createSearchPattern(query, regex, caseSensitive);

    for (let i = session.commandHistory.length - 1; i >= 0 && results.length < limit; i--) {
      const entry = session.commandHistory[i];
      const matches = this.findMatches(entry, searchPattern, includeOutput);

      if (matches.length > 0) {
        results.push({
          index: i,
          command: entry.command,
          timestamp: entry.timestamp,
          matchedText: matches[0],
          context: includeOutput ? this.getContext(entry.output, matches[0]) : undefined,
        });
      }
    }

    return results;
  }

  /**
   * Search through output buffer
   */
  searchOutputBuffer(session: ShellSession, options: SearchOptions): string[] {
    const {
      query,
      regex = false,
      caseSensitive = false,
      limit = 20,
    } = options;

    const searchPattern = this.createSearchPattern(query, regex, caseSensitive);
    const fullOutput = session.outputBuffer.join("");
    const lines = stripAnsi(fullOutput).split("\n");
    const results: string[] = [];

    for (const line of lines) {
      if (results.length >= limit) break;

      if (searchPattern.test(line)) {
        results.push(line);
      }
    }

    return results;
  }

  /**
   * Search for a specific error pattern
   */
  findErrors(session: ShellSession, limit: number = 10): SearchResult[] {
    const errorPatterns = [
      /error[:\s]/i,
      /failed[:\s]/i,
      /exception[:\s]/i,
      /fatal[:\s]/i,
      /denied[:\s]/i,
      /not found/i,
      /permission denied/i,
      /command not found/i,
      /no such file/i,
      /cannot/i,
      /unable to/i,
    ];

    const combinedPattern = new RegExp(
      errorPatterns.map(p => p.source).join("|"),
      "i"
    );

    return this.searchHistory(session, {
      query: combinedPattern.source,
      regex: true,
      caseSensitive: false,
      limit,
      includeOutput: true,
    });
  }

  /**
   * Find commands that match a specific pattern
   */
  findCommands(session: ShellSession, commandPattern: string, limit: number = 20): CommandHistoryEntry[] {
    const pattern = new RegExp(commandPattern, "i");
    const results: CommandHistoryEntry[] = [];

    for (let i = session.commandHistory.length - 1; i >= 0 && results.length < limit; i--) {
      const entry = session.commandHistory[i];
      if (pattern.test(entry.command)) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get unique commands (deduped)
   */
  getUniqueCommands(session: ShellSession, limit: number = 50): string[] {
    const seen = new Set<string>();
    const results: string[] = [];

    for (let i = session.commandHistory.length - 1; i >= 0 && results.length < limit; i--) {
      const cmd = session.commandHistory[i].command;
      if (!seen.has(cmd)) {
        seen.add(cmd);
        results.push(cmd);
      }
    }

    return results;
  }

  /**
   * Create search pattern from query
   */
  private createSearchPattern(query: string, regex: boolean, caseSensitive: boolean): RegExp {
    const flags = caseSensitive ? "g" : "gi";

    if (regex) {
      try {
        return new RegExp(query, flags);
      } catch {
        // Invalid regex, escape and use as literal
        return new RegExp(this.escapeRegex(query), flags);
      }
    }

    return new RegExp(this.escapeRegex(query), flags);
  }

  /**
   * Find matches in a history entry
   */
  private findMatches(entry: CommandHistoryEntry, pattern: RegExp, includeOutput: boolean): string[] {
    const matches: string[] = [];

    // Search in command
    const cmdMatches = entry.command.match(pattern);
    if (cmdMatches) {
      matches.push(...cmdMatches);
    }

    // Search in output if requested
    if (includeOutput && entry.output) {
      const cleanOutput = stripAnsi(entry.output);
      const outputMatches = cleanOutput.match(pattern);
      if (outputMatches) {
        matches.push(...outputMatches);
      }
    }

    return matches;
  }

  /**
   * Get context around a match
   */
  private getContext(output: string, match: string, contextLines: number = 2): string {
    const cleanOutput = stripAnsi(output);
    const lines = cleanOutput.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        return lines.slice(start, end).join("\n");
      }
    }

    return "";
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// Singleton instance
export const outputSearch = new OutputSearch();
