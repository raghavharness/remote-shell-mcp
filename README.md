# Remote Shell MCP Server

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.2.0-green.svg)](https://github.com/your-repo/mcp-remote-shell)

**Persistent SSH sessions for AI assistants.** Give Claude, GPT, or any MCP-compatible AI the ability to maintain long-running remote shell connections—just like [Warp](https://warp.dev) does for developers.

## The Problem

AI assistants are great at generating shell commands, but they can't maintain **persistent connections** to remote servers. Every command runs in isolation:

```
AI: Let me SSH into your server and check the logs.
AI: [runs: ssh user@server "cat /var/log/app.log"]  # Opens connection, runs, closes
AI: Now let me check disk space.
AI: [runs: ssh user@server "df -h"]  # Opens ANOTHER connection, runs, closes
```

This means:
- **No session state** — environment variables, working directory, and context are lost between commands
- **Repeated authentication** — every command requires a new SSH handshake
- **No interactivity** — can't use tools that require persistent shells (vim, less, htop)
- **Broken workflows** — can't `cd` to a directory and then run commands there

## The Solution

Remote Shell MCP provides **Warp-like persistent shell sessions** for AI assistants. Once connected, the session stays open and commands run in context:

```
AI: [starts session → ssh user@server]
AI: [runs: cd /var/log]           # Working directory persists
AI: [runs: tail -f app.log]       # Can run interactive commands
AI: [runs: Ctrl+C]                # Can send signals
AI: [runs: df -h]                 # Still in /var/log, still connected
AI: [ends session]                # Explicit close when done
```

## Why MCP?

**[Model Context Protocol (MCP)](https://modelcontextprotocol.io)** is an open standard that enables AI assistants to interact with external tools and data sources in a secure, standardized way.

Using MCP for remote shell access provides:

- **Standardization** — Works with any MCP-compatible AI (Claude, GPT, local LLMs)
- **Security** — Sessions run in a controlled subprocess, not the AI's sandbox
- **Observability** — All commands and outputs are logged and auditable
- **Extensibility** — Easy to add new connection types (SSH, gcloud, AWS SSM, kubectl)

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Detection** | Recognizes SSH commands (`ssh`, `gcloud compute ssh`, `aws ssm`, etc.) and starts sessions automatically |
| **Persistent Sessions** | Connections stay open until explicitly closed |
| **Multi-Cloud Support** | GCP, AWS, Azure, plain SSH, kubectl, docker, vagrant |
| **Multiple Sessions** | Run concurrent connections with easy switching |
| **Signal Support** | Send Ctrl+C (SIGINT) to interrupt long-running commands |
| **Raw Terminal Output** | Preserves ANSI colors and formatting |
| **Auto-Cleanup** | Stale sessions are cleaned up after 1 hour of inactivity |

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- An MCP-compatible AI client (Claude Code, Claude Desktop, etc.)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/mcp-remote-shell.git
cd mcp-remote-shell

# Install dependencies
npm install

# Build
npm run build
```

### Configure Your AI Client

#### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "remote-shell": {
      "command": "node",
      "args": ["/path/to/mcp-remote-shell/dist/index.js"]
    }
  }
}
```

#### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "remote-shell": {
      "command": "node",
      "args": ["/path/to/mcp-remote-shell/dist/index.js"]
    }
  }
}
```

Restart your AI client after configuration.

## Usage

### The `shell` Tool

The primary interface. It auto-detects remote commands and manages sessions transparently:

```bash
# These commands auto-start a persistent session:
shell(command="ssh user@hostname")
shell(command="gcloud compute ssh my-vm --zone us-central1-a --project my-project")
shell(command="aws ssm start-session --target i-1234567890")
shell(command="kubectl exec -it my-pod -- bash")

# Once connected, commands run in the session:
shell(command="ls -la")
shell(command="cd /var/log && tail -f app.log")
shell(command="docker ps")

# Interrupt a running command (Ctrl+C):
shell(command="//stop")

# End session:
shell(command="//end")
```

### Supported Connection Types

| Type | Pattern | Example |
|------|---------|---------|
| SSH | `ssh [opts] user@host` | `ssh -i ~/.ssh/key user@10.0.0.5` |
| GCP | `gcloud compute ssh` | `gcloud compute ssh vm --zone us-west1-a` |
| AWS | `aws ssm start-session` | `aws ssm start-session --target i-xxx` |
| Azure | `az ssh vm` | `az ssh vm --name vm -g resource-group` |
| Kubernetes | `kubectl exec -it` | `kubectl exec -it pod -- bash` |
| Docker | `docker exec -it` | `docker exec -it container bash` |
| Vagrant | `vagrant ssh` | `vagrant ssh` |

### Control Sequences

These special sequences control the session without conflicting with remote commands:

| Sequence | Action |
|----------|--------|
| `~.` | End session (SSH-style escape) |
| `//end` | End session |
| `//exit` | End session |
| `//quit` | End session |
| `//stop` | Send Ctrl+C (SIGINT) |
| `//kill` | Send Ctrl+C (SIGINT) |
| `//ctrl-c` | Send Ctrl+C (SIGINT) |

### Additional Tools

For advanced session management:

| Tool | Purpose |
|------|---------|
| `remote_session_start` | Explicitly start a session with specific parameters |
| `remote_session_status` | List all active sessions |
| `remote_session_switch` | Switch between multiple sessions |
| `remote_session_end` | End one or all sessions |
| `remote_session_history` | View command history for a session |
| `remote_session_output` | Get raw output buffer |
| `remote_session_signal` | Send signals (SIGINT, SIGTERM, SIGKILL) |

## Example Workflow

Here's a real-world debugging session:

```
User: Connect to my production server and check why the app is slow

Claude: [shell: gcloud compute ssh prod-server --zone us-central1-a --project myapp]
        Session started: gcloud:prod-server

Claude: [shell: top -bn1 | head -20]
        CPU is at 95%! Let me check what's consuming it.

Claude: [shell: ps aux --sort=-%cpu | head -10]
        The app process is using 92% CPU. Checking logs...

Claude: [shell: cd /var/log/myapp && tail -100 error.log]
        Found it - there's a infinite loop in the payment processor.

Claude: [shell: sudo systemctl restart myapp]
        Service restarted.

Claude: [shell: //end]
        Session ended. The app should be recovering now.
```

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│   AI Client     │────▶│  Remote Shell MCP │────▶│  Remote Server  │
│ (Claude Code)   │ MCP │     Server        │ PTY │  (SSH/gcloud)   │
└─────────────────┘     └───────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Session Manager │
                        │  - PTY sessions │
                        │  - SSH2 clients │
                        │  - Output buffer│
                        └─────────────────┘
```

### Connection Modes

1. **PTY Mode** (default): Uses `node-pty` to spawn a pseudo-terminal. Works with any CLI tool (gcloud, aws, kubectl, etc.)

2. **SSH2 Mode**: Direct SSH connections using the `ssh2` library. Better control for pure SSH connections.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev
```

## Troubleshooting

### Session won't start

- Ensure the underlying CLI tool is installed and authenticated (`gcloud auth login`, `aws configure`, etc.)
- Check that your SSH keys are properly configured

### Commands timeout

- Increase `waitTime` for slow commands
- Use `//stop` to interrupt stuck commands

### Session disconnects unexpectedly

- Sessions auto-close after 1 hour of inactivity
- Network issues may drop the connection—just start a new session

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Keywords**: MCP, Model Context Protocol, SSH, remote shell, AI tools, Claude, persistent sessions, terminal, DevOps, cloud computing, GCP, AWS, Azure, kubectl, docker
