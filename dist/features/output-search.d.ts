import { ShellSession, SearchOptions, SearchResult, CommandHistoryEntry } from "../types.js";
export declare class OutputSearch {
    /**
     * Search through command history
     */
    searchHistory(session: ShellSession, options: SearchOptions): SearchResult[];
    /**
     * Search through output buffer
     */
    searchOutputBuffer(session: ShellSession, options: SearchOptions): string[];
    /**
     * Search for a specific error pattern
     */
    findErrors(session: ShellSession, limit?: number): SearchResult[];
    /**
     * Find commands that match a specific pattern
     */
    findCommands(session: ShellSession, commandPattern: string, limit?: number): CommandHistoryEntry[];
    /**
     * Get unique commands (deduped)
     */
    getUniqueCommands(session: ShellSession, limit?: number): string[];
    /**
     * Create search pattern from query
     */
    private createSearchPattern;
    /**
     * Find matches in a history entry
     */
    private findMatches;
    /**
     * Get context around a match
     */
    private getContext;
    /**
     * Escape special regex characters
     */
    private escapeRegex;
}
export declare const outputSearch: OutputSearch;
//# sourceMappingURL=output-search.d.ts.map