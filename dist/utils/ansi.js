// Strip ANSI escape codes for cleaner output
export function stripAnsi(str) {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}
// ANSI color codes for terminal-like output formatting
export const COLORS = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    // Foreground colors
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
    // Background colors
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
    bgRed: "\x1b[41m",
    bgYellow: "\x1b[43m",
};
// Format the prompt/input line with color
export function formatPrompt(sessionName, command) {
    return `${COLORS.bold}${COLORS.green}[${sessionName}]${COLORS.reset} ${COLORS.bold}${COLORS.cyan}$ ${command}${COLORS.reset}`;
}
// Format output separator
export function formatOutputStart() {
    return `${COLORS.dim}${COLORS.gray}────────────────────────────────────────${COLORS.reset}`;
}
export function formatOutputEnd() {
    return `${COLORS.dim}${COLORS.gray}────────────────────────────────────────${COLORS.reset}`;
}
// Format session status
export function formatSessionStatus(connected) {
    if (connected) {
        return `${COLORS.green}●${COLORS.reset} Connected`;
    }
    return `${COLORS.red}○${COLORS.reset} Disconnected`;
}
// Format working directory
export function formatWorkingDir(dir) {
    return `${COLORS.blue}${dir}${COLORS.reset}`;
}
// Format error message
export function formatError(message) {
    return `${COLORS.red}${COLORS.bold}Error:${COLORS.reset} ${COLORS.red}${message}${COLORS.reset}`;
}
// Format success message
export function formatSuccess(message) {
    return `${COLORS.green}${COLORS.bold}✓${COLORS.reset} ${message}`;
}
// Format warning message
export function formatWarning(message) {
    return `${COLORS.yellow}${COLORS.bold}⚠${COLORS.reset} ${COLORS.yellow}${message}${COLORS.reset}`;
}
// Format info message
export function formatInfo(message) {
    return `${COLORS.cyan}ℹ${COLORS.reset} ${message}`;
}
//# sourceMappingURL=ansi.js.map