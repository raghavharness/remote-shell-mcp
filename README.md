# Remote Shell MCP Server

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.0.0-green.svg)](https://github.com/raghavharness/remote-shell-mcp)

**Persistent SSH sessions for AI assistants.** Give Claude, GPT, or any MCP-compatible AI the ability to maintain long-running remote shell connections—just like [Warp](https://warp.dev) does for developers.

## What's New in v3.0

| Feature | Description |
|---------|-------------|
| **File Transfer** | Upload/download files via SFTP or base64 encoding |
| **Port Forwarding** | Local and remote port forwards (SSH -L/-R style) |
| **Smart Wait Time** | Auto-adjusts command timeout based on command type |
| **Working Directory Tracking** | Shows current directory in prompts |
| **Auto-Reconnect** | Automatically attempts to reconnect on disconnection |
| **Output Search** | Search through command history and output |
| **Streaming Output** | Real-time output for long-running commands |
| **Modular Architecture** | Clean separation of concerns for maintainability |

## The Problem

AI assistants can't maintain **persistent connections** to remote servers. Every command runs in isolation:

```
AI: Let me SSH into your server and check the logs.
AI: [runs: ssh user@server "cat /var/log/app.log"]  # Opens connection, runs, closes
AI: Now let me check disk space.
AI: [runs: ssh user@server "df -h"]  # Opens ANOTHER connection, runs, closes
```

This means:
- **No session state** — environment variables, working directory, and context are lost
- **Repeated authentication** — every command requires a new SSH handshake
- **No file transfers** — can't easily upload configs or download logs
- **Broken workflows** — can't `cd` to a directory and then run commands there

## The Solution

Remote Shell MCP provides **Warp-like persistent shell sessions** for AI assistants:

```
AI: [starts session → ssh user@server]
AI: [runs: cd /var/log]           # Working directory persists
AI: [runs: tail -f app.log]       # Can run interactive commands
AI: [sends: Ctrl+C]               # Can send signals
AI: [downloads: error.log]        # Can transfer files
AI: [forwards: 5432 → postgres]   # Can forward ports
AI: [ends session]                # Explicit close when done
```

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Auto-Detection** | Recognizes SSH commands and starts sessions automatically |
| **Persistent Sessions** | Connections stay open until explicitly closed |
| **Multi-Cloud Support** | GCP, AWS, Azure, plain SSH, kubectl, docker, vagrant |
| **Multiple Sessions** | Run concurrent connections with easy switching |
| **Signal Support** | Send Ctrl+C (SIGINT), SIGTERM, SIGKILL |
| **Auto-Cleanup** | Stale sessions cleaned up after 1 hour |

### v3.0 Features

| Feature | Description |
|---------|-------------|
| **File Transfer** | `remote_file_upload`, `remote_file_download`, `remote_file_list` |
| **Port Forwarding** | `remote_port_forward_local`, `remote_port_forward_remote` |
| **Smart Wait** | Auto-adjusts timeout: 500ms for `ls`, 30s for `npm install` |
| **Directory Tracking** | Tracks `cd` commands, shows pwd in prompt |
| **Auto-Reconnect** | Configurable reconnection with backoff |
| **Output Search** | `remote_session_search`, `remote_session_errors` |

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- An MCP-compatible AI client (Claude Code, Claude Desktop, etc.)

### Setup

```bash
# Clone the repository
git clone https://github.com/raghavharness/remote-shell-mcp
cd mcp-remote-shell

# Install dependencies
npm install

# Build
npm run build
```

### Configure Claude Code

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

## Usage

### The `shell` Tool

The primary interface. Auto-detects remote commands and manages sessions:

```bash
# Start a session (auto-detected):
shell(command="ssh user@hostname")
shell(command="gcloud compute ssh my-vm --zone us-central1-a")

# Run commands in session:
shell(command="ls -la")
shell(command="cd /var/log")

# Smart wait auto-adjusts for slow commands:
shell(command="npm install")  # Waits 20s automatically

# Interrupt (Ctrl+C):
shell(command="//stop")

# End session:
shell(command="//end")
```

### File Transfer

```bash
# Upload a local file to remote:
remote_file_upload(localPath="./config.yml", remotePath="/etc/myapp/config.yml")

# Download a remote file:
remote_file_download(remotePath="/var/log/app.log", localPath="./app.log")

# List remote directory:
remote_file_list(path="/var/log")
```

### Port Forwarding

```bash
# Local forward: access remote PostgreSQL on localhost:5433
remote_port_forward_local(localPort=5433, remoteHost="localhost", remotePort=5432)

# Remote forward: expose local dev server to remote
remote_port_forward_remote(remotePort=8080, localPort=3000)

# List active forwards:
remote_port_list()

# Stop a forward:
remote_port_stop(forwardId="fwd-1")
```

### Output Search

```bash
# Search command history:
remote_session_search(query="error", includeOutput=true)

# Find error messages:
remote_session_errors()
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

### Control Sequences & MCP Prompts

Every control sequence has a corresponding MCP prompt (and aliases):

#### Exit Session

| Sequence | MCP Prompt | Aliases |
|----------|------------|---------|
| `~.` | `end-session` | `end`, `exit`, `quit`, `close`, `disconnect` |
| `//end` | `end-session` | |
| `//exit` | `exit` | |
| `//quit` | `quit` | |
| `//close` | `close` | |
| `//disconnect` | `disconnect` | |

#### Interrupt Command

| Sequence | MCP Prompt | Aliases |
|----------|------------|---------|
| `//stop` | `stop` | `kill`, `interrupt`, `ctrl-c` |
| `//kill` | `kill` | |
| `//interrupt` | `interrupt` | |
| `//ctrl-c` | `ctrl-c` | |
| `~c` | `stop` | |

### All MCP Prompts (27)

| Prompt | Description |
|--------|-------------|
| `end-session` | End session (aliases: `end`, `exit`, `quit`, `close`, `disconnect`) |
| `stop` | Send Ctrl+C (aliases: `kill`, `interrupt`, `ctrl-c`) |
| `session-status` | Show all sessions |
| `switch-session` | Switch to different session |
| `session-history` | View command history |
| `exit-nested` | Exit inner shell without killing session |
| `new-session` | Start parallel session |
| `pwd` | Show tracked working directory |
| `reconnect` | Manual reconnection help |
| `upload-file` | Upload file to remote |
| `download-file` | Download file from remote |
| `list-files` | List remote directory |
| `port-forward` | Set up local port forward |
| `list-ports` | List active port forwards |
| `stop-port` | Stop a port forward |
| `stop-all-ports` | Stop all port forwards |
| `find-errors` | Find error messages in history |
| `search-output` | Search command history |

### All Tools (18)

| Tool | Purpose |
|------|---------|
| `shell` | **Primary tool** - execute commands, auto-detect sessions |
| `remote_session_start` | Start session with explicit parameters |
| `remote_session_status` | List all sessions with details |
| `remote_session_switch` | Switch between sessions |
| `remote_session_end` | End session(s) |
| `remote_session_history` | View command history |
| `remote_session_output` | Get raw output buffer |
| `remote_session_signal` | Send signals |
| `remote_session_search` | Search history/output |
| `remote_session_errors` | Find error messages |
| `remote_file_upload` | Upload file to remote |
| `remote_file_download` | Download file from remote |
| `remote_file_list` | List remote directory |
| `remote_port_forward_local` | Start local port forward |
| `remote_port_forward_remote` | Start remote port forward |
| `remote_port_list` | List port forwards |
| `remote_port_stop` | Stop port forward |
| `remote_port_stop_all` | Stop all port forwards |

## Smart Wait Time

Commands automatically get appropriate timeouts:

| Command Type | Wait Time | Example |
|--------------|-----------|---------|
| Quick info | 500ms | `ls`, `pwd`, `whoami` |
| File read | 1s | `cat`, `head` |
| Search | 3s | `grep`, `find` |
| Default | 2s | Most commands |
| Network | 10s | `curl`, `wget` |
| Package install | 15-30s | `npm install`, `pip install` |
| Build | 20-60s | `make`, `docker build` |

Override with explicit `waitTime` parameter when needed.

## Example Workflow

```
User: Connect to prod and figure out why the app is slow

Claude: [shell: gcloud compute ssh prod-server --project myapp]
        Session started: gcloud:prod-server
        Working directory: /home/user

Claude: [shell: top -bn1 | head -20]
        CPU at 95%! Checking what's using it...

Claude: [shell: ps aux --sort=-%cpu | head -10]
        App process using 92% CPU.

Claude: [shell: cd /var/log/myapp]
        [prod-server] /var/log/myapp $

Claude: [remote_session_search: query="error"]
        Found 3 matches in history...

Claude: [shell: tail -100 error.log]
        Found infinite loop in payment processor!

Claude: [remote_file_download: remotePath="error.log", localPath="./error.log"]
        Downloaded 15KB

Claude: [shell: sudo systemctl restart myapp]
        Service restarted.

Claude: [shell: //end]
        Session ended. App should be recovering.
```

## Architecture

```
┌─────────────────┐     ┌───────────────────────────┐     ┌─────────────────┐
│   AI Client     │────▶│    Remote Shell MCP       │────▶│  Remote Server  │
│ (Claude Code)   │ MCP │         Server            │     │  (SSH/gcloud)   │
└─────────────────┘     └───────────────────────────┘     └─────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                ┌───────────────┐       ┌───────────────┐
                │Session Manager│       │   Features    │
                │ - Sessions    │       │ - FileTransfer│
                │ - History     │       │ - PortForward │
                │ - Output      │       │ - SmartWait   │
                └───────────────┘       │ - DirTracker  │
                                        │ - Reconnect   │
                                        │ - Search      │
                                        └───────────────┘
```

### Module Structure

```
src/
├── index.ts              # MCP server entry point
├── session-manager.ts    # Session lifecycle management
├── types.ts              # TypeScript interfaces
├── features/
│   ├── file-transfer.ts  # SFTP/SCP operations
│   ├── port-forward.ts   # Port forwarding
│   ├── smart-wait.ts     # Command timeout logic
│   ├── directory-tracker.ts
│   ├── reconnect.ts
│   ├── output-search.ts
│   └── streaming.ts
├── tools/
│   ├── shell.ts          # Main shell tool
│   ├── session-tools.ts  # Session management
│   ├── file-tools.ts     # File transfer tools
│   └── port-tools.ts     # Port forward tools
├── prompts/
│   └── index.ts          # MCP prompts
└── utils/
    ├── ansi.ts           # Terminal formatting
    └── patterns.ts       # Command detection
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run integration tests (local only)
npm test

# Run with live SSH (requires TEST_SSH_HOST, TEST_SSH_USER)
TEST_SSH_HOST=myserver TEST_SSH_USER=myuser npm test
```

## Troubleshooting

### Session won't start

- Ensure CLI tools are installed and authenticated (`gcloud auth login`, etc.)
- Check SSH keys are configured

### Commands timeout

- Smart wait auto-adjusts, but override with `waitTime` parameter
- Use `//stop` to interrupt stuck commands

### File transfer fails

- SSH2 sessions use SFTP (most reliable)
- Child process sessions use base64 encoding

### Port forward not working

- Ensure local port is available
- Check remote service is running

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Keywords**: MCP, Model Context Protocol, SSH, remote shell, AI tools, Claude, persistent sessions, terminal, DevOps, SFTP, port forwarding, cloud computing
