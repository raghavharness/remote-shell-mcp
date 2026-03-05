import { stripAnsi } from "../utils/ansi.js";
import { ErrorContext } from "../utils/terminal-ui.js";

export interface ErrorAnalysis {
  isError: boolean;
  errorType?: ErrorType;
  exitCode?: number;
  stderr?: string;
  context: ErrorContext;
}

export type ErrorType =
  | "permission_denied"
  | "command_not_found"
  | "file_not_found"
  | "directory_not_found"
  | "connection_refused"
  | "timeout"
  | "syntax_error"
  | "package_not_found"
  | "disk_full"
  | "memory_error"
  | "network_error"
  | "authentication_failed"
  | "unknown";

interface ErrorPattern {
  pattern: RegExp;
  type: ErrorType;
  getSuggestion: (match: RegExpMatchArray, command: string, output: string) => SuggestionResult;
}

interface SuggestionResult {
  fix?: string;
  autoFixable: boolean;
  context?: string;
}

// Package manager detection
function detectPackageManager(output: string): string {
  const cleanOutput = stripAnsi(output).toLowerCase();

  // Check for common package manager indicators
  if (cleanOutput.includes("apt") || cleanOutput.includes("debian") || cleanOutput.includes("ubuntu")) {
    return "apt";
  }
  if (cleanOutput.includes("yum") || cleanOutput.includes("centos") || cleanOutput.includes("rhel") || cleanOutput.includes("amazon linux")) {
    return "yum";
  }
  if (cleanOutput.includes("dnf") || cleanOutput.includes("fedora")) {
    return "dnf";
  }
  if (cleanOutput.includes("pacman") || cleanOutput.includes("arch")) {
    return "pacman";
  }
  if (cleanOutput.includes("brew") || cleanOutput.includes("darwin") || cleanOutput.includes("macos")) {
    return "brew";
  }
  if (cleanOutput.includes("apk") || cleanOutput.includes("alpine")) {
    return "apk";
  }

  // Default to apt as most common
  return "apt";
}

// Get install command for a package
function getInstallCommand(packageName: string, packageManager: string): string {
  const commands: Record<string, string> = {
    apt: `sudo apt-get install -y ${packageName}`,
    yum: `sudo yum install -y ${packageName}`,
    dnf: `sudo dnf install -y ${packageName}`,
    pacman: `sudo pacman -S --noconfirm ${packageName}`,
    brew: `brew install ${packageName}`,
    apk: `sudo apk add ${packageName}`,
  };
  return commands[packageManager] || `sudo apt-get install -y ${packageName}`;
}

// Error patterns with suggestions
const ERROR_PATTERNS: ErrorPattern[] = [
  // Command not found
  {
    pattern: /(?:command not found|not found|: not found|bash: ([\w-]+): command not found|([\w-]+): command not found)/i,
    type: "command_not_found",
    getSuggestion: (match, command, output) => {
      const cmdName = match[1] || match[2] || command.split(/\s+/)[0];
      const pm = detectPackageManager(output);
      return {
        fix: getInstallCommand(cmdName, pm),
        autoFixable: true, // Package installs are auto-fixable per user request
        context: `Command '${cmdName}' not found. Detected package manager: ${pm}`,
      };
    },
  },

  // Permission denied (NOT auto-fixable - requires sudo)
  {
    pattern: /permission denied|EACCES|access denied|Operation not permitted/i,
    type: "permission_denied",
    getSuggestion: (match, command) => {
      return {
        fix: `sudo ${command}`,
        autoFixable: false, // User must confirm sudo
        context: "Permission denied. Elevated privileges may be required.",
      };
    },
  },

  // File not found
  {
    pattern: /(?:No such file or directory|ENOENT|cannot stat|cannot access)[:\s]*['"]?([^\s'"]+)?/i,
    type: "file_not_found",
    getSuggestion: (match, command) => {
      const path = match[1];
      if (path && !path.includes("*")) {
        // Check if it's a directory issue
        const parentDir = path.split("/").slice(0, -1).join("/");
        if (parentDir) {
          return {
            fix: `mkdir -p ${parentDir}`,
            autoFixable: true, // Creating directories is harmless
            context: `Path '${path}' not found. Parent directory may need to be created.`,
          };
        }
      }
      return {
        autoFixable: false,
        context: `File or directory not found: ${path || "unknown path"}`,
      };
    },
  },

  // Directory not found (for cd commands)
  {
    pattern: /(?:cd:|No such file or directory|cannot change directory|ENOENT).*?(['"]?)([\/~][\w\/-]+)\1/i,
    type: "directory_not_found",
    getSuggestion: (match) => {
      const dir = match[2];
      return {
        fix: `mkdir -p ${dir} && cd ${dir}`,
        autoFixable: true, // Creating directories is harmless
        context: `Directory '${dir}' does not exist.`,
      };
    },
  },

  // Connection refused
  {
    pattern: /connection refused|ECONNREFUSED|connect: connection refused/i,
    type: "connection_refused",
    getSuggestion: () => ({
      autoFixable: false,
      context: "Connection refused. The target service may not be running or the port may be incorrect.",
    }),
  },

  // Network errors
  {
    pattern: /network is unreachable|no route to host|name or service not known|could not resolve|ENETUNREACH|EHOSTUNREACH/i,
    type: "network_error",
    getSuggestion: () => ({
      autoFixable: false,
      context: "Network connectivity issue. Check your network connection and DNS settings.",
    }),
  },

  // Timeout
  {
    pattern: /timed? ?out|timeout|ETIMEDOUT|connection timed out/i,
    type: "timeout",
    getSuggestion: (match, command) => ({
      fix: command, // Retry the same command
      autoFixable: false, // Don't auto-retry, let AI decide
      context: "Operation timed out. May be worth retrying.",
    }),
  },

  // Authentication failed
  {
    pattern: /authentication failed|permission denied \(publickey|invalid credentials|auth fail|unauthorized/i,
    type: "authentication_failed",
    getSuggestion: () => ({
      autoFixable: false,
      context: "Authentication failed. Check credentials, SSH keys, or permissions.",
    }),
  },

  // Disk full
  {
    pattern: /no space left|disk full|ENOSPC|quota exceeded/i,
    type: "disk_full",
    getSuggestion: () => ({
      fix: "df -h && du -sh /* 2>/dev/null | sort -hr | head -20",
      autoFixable: false,
      context: "Disk space is full. Need to free up space.",
    }),
  },

  // Memory error
  {
    pattern: /out of memory|cannot allocate|ENOMEM|memory allocation failed|killed.*memory/i,
    type: "memory_error",
    getSuggestion: () => ({
      fix: "free -h && ps aux --sort=-%mem | head -10",
      autoFixable: false,
      context: "Out of memory. May need to free memory or increase available resources.",
    }),
  },

  // Syntax error
  {
    pattern: /syntax error|unexpected token|parse error|unterminated|missing operand/i,
    type: "syntax_error",
    getSuggestion: () => ({
      autoFixable: false,
      context: "Syntax error in command. Check command syntax.",
    }),
  },

  // Package not found (various package managers)
  {
    pattern: /(?:E: Unable to locate package|No package .* available|error: target not found|package .* is not available|No match for argument|not found in any configured repository)\s*([\w-]+)?/i,
    type: "package_not_found",
    getSuggestion: (match, command, output) => {
      const pm = detectPackageManager(output);
      const updateCmd: Record<string, string> = {
        apt: "sudo apt-get update",
        yum: "sudo yum check-update",
        dnf: "sudo dnf check-update",
        pacman: "sudo pacman -Sy",
        brew: "brew update",
        apk: "sudo apk update",
      };
      return {
        fix: updateCmd[pm] || "sudo apt-get update",
        autoFixable: true, // Updating package lists is safe
        context: `Package not found. Try updating package lists first.`,
      };
    },
  },
];

/**
 * Analyze command output for errors
 */
export function analyzeError(
  command: string,
  output: string,
  exitCode?: number
): ErrorAnalysis {
  const cleanOutput = stripAnsi(output);

  // If exit code is 0, it's not an error
  if (exitCode === 0) {
    return {
      isError: false,
      context: {},
    };
  }

  // Check for error patterns
  for (const errorPattern of ERROR_PATTERNS) {
    const match = cleanOutput.match(errorPattern.pattern);
    if (match) {
      const suggestion = errorPattern.getSuggestion(match, command, output);
      const pm = detectPackageManager(output);

      return {
        isError: true,
        errorType: errorPattern.type,
        exitCode,
        stderr: cleanOutput,
        context: {
          errorType: errorPattern.type.replace(/_/g, " "),
          suggestedFix: suggestion.fix,
          autoFixable: suggestion.autoFixable,
          additionalContext: suggestion.context,
          packageManager: pm,
        },
      };
    }
  }

  // If exit code indicates error but no pattern matched
  if (exitCode !== undefined && exitCode !== 0) {
    return {
      isError: true,
      errorType: "unknown",
      exitCode,
      stderr: cleanOutput,
      context: {
        errorType: "unknown error",
        additionalContext: `Command exited with code ${exitCode}. Review the output for details.`,
      },
    };
  }

  return {
    isError: false,
    context: {},
  };
}

/**
 * Check if an error is auto-fixable
 */
export function isAutoFixable(analysis: ErrorAnalysis): boolean {
  return analysis.context.autoFixable === true;
}

/**
 * Get the suggested fix command
 */
export function getSuggestedFix(analysis: ErrorAnalysis): string | undefined {
  return analysis.context.suggestedFix;
}

// Singleton for caching OS detection results
class ErrorHandler {
  private osCache: Map<string, string> = new Map();
  private pmCache: Map<string, string> = new Map();

  /**
   * Cache OS detection for a session
   */
  setOsForSession(sessionId: string, os: string): void {
    this.osCache.set(sessionId, os);
  }

  /**
   * Cache package manager for a session
   */
  setPackageManagerForSession(sessionId: string, pm: string): void {
    this.pmCache.set(sessionId, pm);
  }

  /**
   * Get cached OS for session
   */
  getOsForSession(sessionId: string): string | undefined {
    return this.osCache.get(sessionId);
  }

  /**
   * Get cached package manager for session
   */
  getPackageManagerForSession(sessionId: string): string | undefined {
    return this.pmCache.get(sessionId);
  }

  /**
   * Analyze error with session context
   */
  analyzeWithSession(
    sessionId: string,
    command: string,
    output: string,
    exitCode?: number
  ): ErrorAnalysis {
    const analysis = analyzeError(command, output, exitCode);

    // Enhance with cached session info
    const cachedPm = this.pmCache.get(sessionId);
    if (cachedPm && analysis.context) {
      analysis.context.packageManager = cachedPm;
    }

    const cachedOs = this.osCache.get(sessionId);
    if (cachedOs && analysis.context) {
      analysis.context.os = cachedOs;
    }

    return analysis;
  }

  /**
   * Clear session cache
   */
  clearSession(sessionId: string): void {
    this.osCache.delete(sessionId);
    this.pmCache.delete(sessionId);
  }
}

export const errorHandler = new ErrorHandler();
