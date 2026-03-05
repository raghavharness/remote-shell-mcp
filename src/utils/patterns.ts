// Session exit patterns - use special sequences to avoid conflict with Claude
export const SESSION_EXIT_PATTERNS = [
  /^~\.$/,                    // SSH-style escape: ~.
  /^\/\/end$/i,               // //end
  /^\/\/exit$/i,              // //exit
  /^\/\/quit$/i,              // //quit
  /^\/\/close$/i,             // //close
  /^\/\/disconnect$/i,        // //disconnect
];

export function isSessionExitCommand(command: string): boolean {
  const trimmed = command.trim();
  return SESSION_EXIT_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Interrupt patterns - send Ctrl+C / SIGINT
export const SESSION_INTERRUPT_PATTERNS = [
  /^\/\/stop$/i,              // //stop
  /^\/\/kill$/i,              // //kill
  /^\/\/interrupt$/i,         // //interrupt
  /^\/\/ctrl-?c$/i,           // //ctrl-c or //ctrlc
  /^~c$/i,                    // ~c (SSH-style)
];

export function isSessionInterruptCommand(command: string): boolean {
  const trimmed = command.trim();
  return SESSION_INTERRUPT_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Patterns that indicate a remote shell command
export const REMOTE_COMMAND_PATTERNS = [
  /^gcloud\s+compute\s+ssh\b/,
  /^gcloud\s+.*\s+ssh\b/,
  /^ssh\s+/,
  /^aws\s+ssm\s+start-session\b/,
  /^az\s+ssh\s+vm\b/,
  /^az\s+vm\s+ssh\b/,
  /^kubectl\s+exec\s+.*-it/,
  /^docker\s+exec\s+.*-it/,
  /^vagrant\s+ssh\b/,
  /^heroku\s+run\s+bash\b/,
  /^fly\s+ssh\s+console\b/,
];

// Check if a command opens a remote shell
export function isRemoteShellCommand(command: string): boolean {
  const trimmed = command.trim();
  return REMOTE_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// Extract a friendly name from the command
export function extractSessionName(command: string): string {
  const trimmed = command.trim();

  // gcloud compute ssh instance-name
  const gcloudMatch = trimmed.match(
    /gcloud\s+compute\s+ssh\s+["']?([^\s"']+)["']?/
  );
  if (gcloudMatch) return `gcloud:${gcloudMatch[1]}`;

  // ssh user@host or ssh host
  const sshMatch = trimmed.match(/ssh\s+(?:-[^\s]+\s+)*(?:(\S+)@)?(\S+)/);
  if (sshMatch) {
    const user = sshMatch[1] || "user";
    const host = sshMatch[2];
    return `ssh:${user}@${host}`;
  }

  // aws ssm start-session --target i-xxx
  const awsMatch = trimmed.match(/--target\s+["']?([^\s"']+)["']?/);
  if (awsMatch) return `aws:${awsMatch[1]}`;

  // az ssh vm --name xxx
  const azMatch = trimmed.match(/--name\s+["']?([^\s"']+)["']?/);
  if (azMatch) return `azure:${azMatch[1]}`;

  // kubectl exec pod-name
  const kubectlMatch = trimmed.match(/kubectl\s+exec\s+(?:-[^\s]+\s+)*(\S+)/);
  if (kubectlMatch) return `k8s:${kubectlMatch[1]}`;

  // docker exec container
  const dockerMatch = trimmed.match(/docker\s+exec\s+(?:-[^\s]+\s+)*(\S+)/);
  if (dockerMatch) return `docker:${dockerMatch[1]}`;

  return `remote:${Date.now()}`;
}

// Patterns for directory change detection
export const CD_PATTERNS = [
  /^cd\s+(.+)$/,
  /^pushd\s+(.+)$/,
  /^popd$/,
];

export function isCdCommand(command: string): boolean {
  const trimmed = command.trim();
  return CD_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function extractCdTarget(command: string): string | null {
  const trimmed = command.trim();

  const cdMatch = trimmed.match(/^cd\s+(.+)$/);
  if (cdMatch) return cdMatch[1].trim();

  const pushdMatch = trimmed.match(/^pushd\s+(.+)$/);
  if (pushdMatch) return pushdMatch[1].trim();

  if (/^popd$/.test(trimmed)) return "__POPD__";

  return null;
}
