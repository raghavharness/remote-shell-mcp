import { stripAnsi } from "../utils/ansi.js";
export class OutputSearch {
    /**
     * Search through command history
     */
    searchHistory(session, options) {
        const { query, regex = false, caseSensitive = false, limit = 50, includeOutput = false, } = options;
        const results = [];
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
    searchOutputBuffer(session, options) {
        const { query, regex = false, caseSensitive = false, limit = 20, } = options;
        const searchPattern = this.createSearchPattern(query, regex, caseSensitive);
        const fullOutput = session.outputBuffer.join("");
        const lines = stripAnsi(fullOutput).split("\n");
        const results = [];
        for (const line of lines) {
            if (results.length >= limit)
                break;
            if (searchPattern.test(line)) {
                results.push(line);
            }
        }
        return results;
    }
    /**
     * Search for a specific error pattern
     */
    findErrors(session, limit = 10) {
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
        const combinedPattern = new RegExp(errorPatterns.map(p => p.source).join("|"), "i");
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
    findCommands(session, commandPattern, limit = 20) {
        const pattern = new RegExp(commandPattern, "i");
        const results = [];
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
    getUniqueCommands(session, limit = 50) {
        const seen = new Set();
        const results = [];
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
    createSearchPattern(query, regex, caseSensitive) {
        const flags = caseSensitive ? "g" : "gi";
        if (regex) {
            try {
                return new RegExp(query, flags);
            }
            catch {
                // Invalid regex, escape and use as literal
                return new RegExp(this.escapeRegex(query), flags);
            }
        }
        return new RegExp(this.escapeRegex(query), flags);
    }
    /**
     * Find matches in a history entry
     */
    findMatches(entry, pattern, includeOutput) {
        const matches = [];
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
    getContext(output, match, contextLines = 2) {
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
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
// Singleton instance
export const outputSearch = new OutputSearch();
//# sourceMappingURL=output-search.js.map