import { COLORS } from "./ansi.js";

// Box drawing characters
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
  topT: "┬",
  bottomT: "┴",
  cross: "┼",
};

// Icons for different states
export const ICONS = {
  folder: "📁",
  connected: "●",
  disconnected: "○",
  clock: "⏱",
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  suggestion: "💡",
  autoFix: "🔧",
  command: "$",
};

export interface TerminalBoxOptions {
  title?: string;
  width?: number;
  sessionName?: string;
  workingDir?: string;
  connected?: boolean;
  uptime?: string;
}

/**
 * Calculate display width of a string (accounting for ANSI codes and emojis)
 */
function displayWidth(str: string): number {
  // Strip ANSI codes
  const stripped = str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
  // Count emojis as width 2
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0) || 0;
    // Emoji ranges (simplified)
    if (code > 0x1f300) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Pad string to target width (accounting for ANSI codes)
 */
function padToWidth(str: string, targetWidth: number): string {
  const currentWidth = displayWidth(str);
  const padding = Math.max(0, targetWidth - currentWidth);
  return str + " ".repeat(padding);
}

/**
 * Create a horizontal line with optional title
 */
function horizontalLine(width: number, title?: string): string {
  if (!title) {
    return BOX.horizontal.repeat(width);
  }
  const titleWithSpaces = ` ${title} `;
  const titleWidth = displayWidth(titleWithSpaces);
  const remainingWidth = width - titleWidth;
  const leftPart = Math.floor(remainingWidth / 2);
  const rightPart = remainingWidth - leftPart;
  return (
    BOX.horizontal.repeat(leftPart) +
    titleWithSpaces +
    BOX.horizontal.repeat(rightPart)
  );
}

/**
 * Format the status bar content
 */
function formatStatusBar(
  workingDir: string,
  connected: boolean,
  uptime?: string,
  width?: number
): string {
  const dirPart = `${ICONS.folder} ${COLORS.blue}${workingDir}${COLORS.reset}`;
  const statusIcon = connected
    ? `${COLORS.green}${ICONS.connected}${COLORS.reset}`
    : `${COLORS.red}${ICONS.disconnected}${COLORS.reset}`;
  const statusText = connected ? "Connected" : "Disconnected";
  const statusPart = `${statusIcon} ${statusText}`;
  const uptimePart = uptime ? `${ICONS.clock} ${uptime}` : "";

  const parts = [dirPart, statusPart];
  if (uptimePart) parts.push(uptimePart);

  return parts.join(` ${COLORS.gray}│${COLORS.reset} `);
}

/**
 * Create a framed terminal box header
 */
export function formatBoxHeader(options: TerminalBoxOptions): string {
  const width = options.width || 60;
  const innerWidth = width - 2; // Account for left and right borders

  const lines: string[] = [];

  // Top border with session name
  const title = options.sessionName
    ? `${COLORS.bold}${COLORS.cyan}${options.sessionName}${COLORS.reset}`
    : undefined;
  lines.push(
    `${COLORS.gray}${BOX.topLeft}${horizontalLine(innerWidth, title)}${BOX.topRight}${COLORS.reset}`
  );

  // Status bar (if we have session info)
  if (options.workingDir !== undefined) {
    const statusContent = formatStatusBar(
      options.workingDir,
      options.connected ?? false,
      options.uptime,
      innerWidth
    );
    lines.push(
      `${COLORS.gray}${BOX.vertical}${COLORS.reset} ${padToWidth(statusContent, innerWidth - 1)}${COLORS.gray}${BOX.vertical}${COLORS.reset}`
    );

    // Separator
    lines.push(
      `${COLORS.gray}${BOX.leftT}${BOX.horizontal.repeat(innerWidth)}${BOX.rightT}${COLORS.reset}`
    );
  }

  return lines.join("\n");
}

/**
 * Format a command line within the box
 */
export function formatBoxCommand(command: string, width?: number): string {
  const w = width || 60;
  const innerWidth = w - 2;
  const cmdLine = `${COLORS.bold}${COLORS.green}${ICONS.command}${COLORS.reset} ${COLORS.cyan}${command}${COLORS.reset}`;
  return `${COLORS.gray}${BOX.vertical}${COLORS.reset} ${padToWidth(cmdLine, innerWidth - 1)}${COLORS.gray}${BOX.vertical}${COLORS.reset}`;
}

/**
 * Create a box footer
 */
export function formatBoxFooter(width?: number): string {
  const w = width || 60;
  const innerWidth = w - 2;
  return `${COLORS.gray}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}${COLORS.reset}`;
}

/**
 * Format the main prompt line (always shows directory)
 */
export function formatTerminalPrompt(
  sessionName: string,
  workingDir: string,
  command: string
): string {
  return `${COLORS.bold}${COLORS.green}[${sessionName}]${COLORS.reset} ${COLORS.blue}${workingDir}${COLORS.reset} ${COLORS.bold}${COLORS.cyan}${ICONS.command}${COLORS.reset} ${command}`;
}

/**
 * Format session header with full box UI
 */
export function formatSessionHeader(
  sessionName: string,
  workingDir: string,
  connected: boolean,
  command: string,
  uptime?: string
): string {
  const width = 60;
  const lines: string[] = [];

  lines.push(
    formatBoxHeader({
      sessionName,
      workingDir,
      connected,
      uptime,
      width,
    })
  );
  lines.push(formatBoxCommand(command, width));
  lines.push(formatBoxFooter(width));

  return lines.join("\n");
}

/**
 * Format output content (no box, just clean output)
 */
export function formatOutputContent(output: string): string {
  return output;
}

/**
 * Format an error block with context for AI analysis
 */
export function formatErrorBlock(
  command: string,
  exitCode: number | undefined,
  stderr: string,
  context: ErrorContext
): string {
  const lines: string[] = [];
  const width = 60;
  const innerWidth = width - 2;

  // Error header
  lines.push(
    `${COLORS.gray}${BOX.topLeft}${horizontalLine(innerWidth, `${COLORS.red}${COLORS.bold}${ICONS.error} Error${COLORS.reset}`)}${BOX.topRight}${COLORS.reset}`
  );

  // Exit code
  if (exitCode !== undefined) {
    const exitLine = `Exit code: ${COLORS.red}${exitCode}${COLORS.reset}`;
    lines.push(
      `${COLORS.gray}${BOX.vertical}${COLORS.reset} ${padToWidth(exitLine, innerWidth - 1)}${COLORS.gray}${BOX.vertical}${COLORS.reset}`
    );
  }

  // Error type if detected
  if (context.errorType) {
    const typeLine = `Type: ${COLORS.yellow}${context.errorType}${COLORS.reset}`;
    lines.push(
      `${COLORS.gray}${BOX.vertical}${COLORS.reset} ${padToWidth(typeLine, innerWidth - 1)}${COLORS.gray}${BOX.vertical}${COLORS.reset}`
    );
  }

  // Separator before stderr
  lines.push(
    `${COLORS.gray}${BOX.leftT}${BOX.horizontal.repeat(innerWidth)}${BOX.rightT}${COLORS.reset}`
  );

  // Stderr content
  const stderrLines = stderr.split("\n").slice(0, 10); // Limit to 10 lines
  for (const line of stderrLines) {
    lines.push(
      `${COLORS.gray}${BOX.vertical}${COLORS.reset} ${COLORS.red}${line}${COLORS.reset}`
    );
  }

  // Footer
  lines.push(
    `${COLORS.gray}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}${COLORS.reset}`
  );

  // Suggestion section (for AI to read)
  if (context.suggestedFix) {
    lines.push("");
    lines.push(
      `${COLORS.yellow}${ICONS.suggestion} Suggested fix:${COLORS.reset}`
    );
    lines.push(`   ${COLORS.cyan}${context.suggestedFix}${COLORS.reset}`);
    if (context.autoFixable) {
      lines.push(
        `   ${COLORS.green}${ICONS.autoFix} [Auto-fixable]${COLORS.reset}`
      );
    }
  }

  // Context for AI
  if (context.additionalContext) {
    lines.push("");
    lines.push(`${COLORS.gray}Context: ${context.additionalContext}${COLORS.reset}`);
  }

  return lines.join("\n");
}

export interface ErrorContext {
  errorType?: string;
  suggestedFix?: string;
  autoFixable?: boolean;
  additionalContext?: string;
  packageManager?: string;
  os?: string;
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return `${COLORS.green}${ICONS.success}${COLORS.reset} ${message}`;
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return `${COLORS.yellow}${ICONS.warning}${COLORS.reset} ${COLORS.yellow}${message}${COLORS.reset}`;
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return `${COLORS.cyan}${ICONS.info}${COLORS.reset} ${message}`;
}

/**
 * Calculate uptime string from start date
 */
export function formatUptime(startedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startedAt.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`;
  } else if (diffMins > 0) {
    return `${diffMins}m ${diffSecs % 60}s`;
  } else {
    return `${diffSecs}s`;
  }
}
