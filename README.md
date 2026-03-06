# Remote Shell MCP Server

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-5.0.0-green.svg)](https://github.com/raghavharness/remote-shell-mcp)

**Persistent SSH sessions for AI assistants.** Give Claude, GPT, or any MCP-compatible AI the ability to maintain long-running remote shell connections—just like [Warp](https://warp.dev) does for developers.

## What's New in v5.0

| Feature | Description |
|---------|-------------|
| **TTY Input** | Respond to interactive prompts (passwords, confirmations) directly |
| **Swarm Mode** | Launch parallel SSH sessions to multiple machines simultaneously |
| **Broadcast Commands** | Execute the same command across all machines in a swarm |
| **Real-time Streaming** | Monitor output in real-time with error pattern detection |
| **Auto-Interrupt** | Automatically send Ctrl+C when errors are detected |

## What's New in v4.0

| Feature | Description |
|---------|-------------|
| **Block-Based Output** | Warp-style command blocks with search, tagging, and copy |
| **Pane Management** | tmux-style split panes for multi-view sessions |
| **Session Sharing** | Real-time collaboration with shareable URLs |
| **Enhanced Persistence** | Session state persistence and faster reconnection |
| **Heartbeat Monitoring** | Faster disconnect detection |

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
AI: [shares session]              # Collaborate in real-time
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

### v4.0 Features

| Feature | Description |
|---------|-------------|
| **Blocks** | Every command creates a searchable, taggable block |
| **Panes** | Split view with broadcast commands |
| **Sharing** | Real-time session collaboration |
| **Persistence** | State saved to disk for recovery |
| **Heartbeat** | Fast disconnect detection |

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

### Block-Based Output (NEW in v4.0)

Every command creates a block that can be referenced later:

```bash
# List recent blocks
remote_blocks_list(limit=10)

# Get a specific block
remote_block_get(blockId="block-5")

# Search through blocks
remote_blocks_search(query="error")

# Copy just the output (no command)
remote_block_copy(blockId="block-5")

# Tag blocks for organization
remote_block_tag(blockId="block-5", tags=["important", "debug"])

# Find error blocks
remote_blocks_errors()
```

### Pane Management (NEW in v4.0)

tmux-style panes within a session:

```bash
# Split the current pane
remote_pane_split(direction="horizontal")
remote_pane_split(direction="vertical")

# List panes
remote_pane_list()

# Switch to a pane
remote_pane_focus(paneId="pane-1")

# Run command in specific pane (without switching)
remote_pane_exec(paneId="pane-1", command="tail -f /var/log/app.log")

# Broadcast command to ALL panes
remote_pane_broadcast(command="uptime")

# Close a pane
remote_pane_close(paneId="pane-1")
```

### TTY Input (NEW in v5.0)

Respond to interactive prompts directly:

```bash
# Check if session is waiting for input
remote_session_check_prompt()

# Send text input
remote_session_input(input="my-response")

# Send password (hidden in output)
remote_session_password(password="secret123")

# Send Y/N confirmation
remote_session_confirm(confirm=true)
```

### Swarm Mode (NEW in v5.0)

Launch parallel SSH sessions to multiple machines:

```bash
# Create a swarm of SSH connections
remote_swarm_create(
  name="web-servers",
  method="ssh",
  targets=[
    { "id": "web1", "host": "10.0.0.1", "username": "admin" },
    { "id": "web2", "host": "10.0.0.2", "username": "admin" },
    { "id": "web3", "host": "10.0.0.3", "username": "admin" }
  ]
)

# Create a GCloud swarm
remote_swarm_create(
  name="gcp-cluster",
  method="gcloud",
  targets=[
    { "id": "node1", "instance": "gke-node-1", "zone": "us-central1-a" },
    { "id": "node2", "instance": "gke-node-2", "zone": "us-central1-a" }
  ]
)

# Broadcast command to all targets
remote_swarm_exec(swarmId="swarm-1", command="uptime")
remote_swarm_exec(swarmId="swarm-1", command="df -h")

# Send input to all sessions (e.g., for sudo password)
remote_swarm_input(swarmId="swarm-1", input="mypassword")

# Interrupt all sessions
remote_swarm_interrupt(swarmId="swarm-1")

# List swarms
remote_swarm_list()

# Get detailed swarm status
remote_swarm_status(swarmId="swarm-1")

# End a swarm
remote_swarm_end(swarmId="swarm-1")
remote_swarm_end(swarmId="all")  # End all swarms
```

### Real-time Streaming (NEW in v5.0)

Enable real-time output streaming with error detection:

```bash
# Enable streaming with auto-interrupt on errors
remote_stream_enable(autoInterrupt=true)

# Add custom error patterns
remote_stream_enable(
  autoInterrupt=true,
  errorPatterns=["CRITICAL", "OutOfMemory", "Segfault"]
)

# Check streaming status
remote_stream_status()

# Disable streaming
remote_stream_disable()
```

When streaming is enabled:
- Output is monitored in real-time
- Error patterns are detected immediately
- Interactive prompts are detected
- Auto-interrupt sends Ctrl+C when errors are found

### Session Sharing (NEW in v4.0)

Share sessions for real-time collaboration:

```bash
# Share the current session
remote_session_share(permissions="view")
# Returns: http://localhost:3847/share/abc123

# Share with control access and password
remote_session_share(permissions="control", password="secret123")

# List active shares
remote_shares_list()

# Update share settings
remote_share_update(shareId="abc123", permissions="control")

# Stop sharing
remote_session_unshare()
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

Every control sequence has a corresponding MCP prompt:

#### Exit Session

| Sequence | MCP Prompt | Aliases |
|----------|------------|---------|
| `~.` | `end-session` | `end`, `exit`, `quit`, `close`, `disconnect` |
| `//end` | `end-session` | |

#### Interrupt Command

| Sequence | MCP Prompt | Aliases |
|----------|------------|---------|
| `//stop` | `stop` | `kill`, `interrupt`, `ctrl-c` |

#### Blocks

| MCP Prompt | Description |
|------------|-------------|
| `blocks` | List recent command blocks |
| `block` | Get a specific block |
| `block-search` | Search through blocks |
| `block-errors` | Find error blocks |
| `block-tag` | Tag a block |

#### Panes

| MCP Prompt | Description |
|------------|-------------|
| `split` | Split current pane |
| `panes` | List panes |
| `pane-focus` | Switch to pane |
| `pane-close` | Close a pane |
| `broadcast` | Broadcast command to all panes |

#### Sharing

| MCP Prompt | Description |
|------------|-------------|
| `share` | Share current session |
| `unshare` | Stop sharing |
| `shares` | List active shares |

### All Tools (50)

| Tool | Purpose |
|------|---------|
| **Core** | |
| `shell` | Primary tool - execute commands, auto-detect sessions |
| `remote_session_start` | Start session with explicit parameters |
| `remote_session_status` | List all sessions with details |
| `remote_session_switch` | Switch between sessions |
| `remote_session_end` | End session(s) |
| `remote_session_history` | View command history |
| `remote_session_output` | Get raw output buffer |
| `remote_session_signal` | Send signals |
| `remote_session_search` | Search history/output |
| `remote_session_errors` | Find error messages |
| **Files** | |
| `remote_file_upload` | Upload file to remote |
| `remote_file_download` | Download file from remote |
| `remote_file_list` | List remote directory |
| **Ports** | |
| `remote_port_forward_local` | Start local port forward |
| `remote_port_forward_remote` | Start remote port forward |
| `remote_port_list` | List port forwards |
| `remote_port_stop` | Stop port forward |
| `remote_port_stop_all` | Stop all port forwards |
| **Blocks (v4.0)** | |
| `remote_blocks_list` | List command blocks |
| `remote_block_get` | Get specific block |
| `remote_blocks_search` | Search blocks |
| `remote_block_copy` | Copy block output |
| `remote_block_tag` | Tag a block |
| `remote_block_untag` | Remove block tags |
| `remote_block_collapse` | Toggle block collapsed |
| `remote_blocks_errors` | Find error blocks |
| **Panes (v4.0)** | |
| `remote_pane_split` | Split pane |
| `remote_pane_focus` | Focus pane |
| `remote_pane_close` | Close pane |
| `remote_pane_list` | List panes |
| `remote_pane_exec` | Execute in specific pane |
| `remote_pane_broadcast` | Broadcast to all panes |
| `remote_pane_rename` | Rename pane |
| `remote_pane_next` | Focus next pane |
| **Sharing (v4.0)** | |
| `remote_session_share` | Share session |
| `remote_session_unshare` | Stop sharing |
| `remote_shares_list` | List shares |
| `remote_share_update` | Update share settings |
| `remote_share_server_start` | Start share server |
| `remote_share_server_stop` | Stop share server |
| **Swarm (v5.0)** | |
| `remote_swarm_create` | Create parallel session swarm |
| `remote_swarm_list` | List active swarms |
| `remote_swarm_status` | Get swarm details |
| `remote_swarm_exec` | Broadcast command to swarm |
| `remote_swarm_input` | Send input to all swarm sessions |
| `remote_swarm_interrupt` | Interrupt all swarm sessions |
| `remote_swarm_end` | End swarm |
| `remote_swarm_add_target` | Add target to swarm |
| `remote_swarm_remove_target` | Remove target from swarm |
| **Input/Streaming (v5.0)** | |
| `remote_session_input` | Send input to session |
| `remote_session_check_prompt` | Check for pending prompts |
| `remote_session_confirm` | Send Y/N confirmation |
| `remote_session_password` | Send password (hidden) |
| `remote_stream_enable` | Enable real-time streaming |
| `remote_stream_disable` | Disable streaming |
| `remote_stream_status` | Get streaming status |

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
        [block-1]

Claude: [shell: ps aux --sort=-%cpu | head -10]
        App process using 92% CPU.
        [block-2]

Claude: [remote_blocks_search: query="error"]
        Found 3 matches in block history...

Claude: [remote_pane_split: direction="horizontal"]
        Split into 2 panes for monitoring

Claude: [remote_pane_exec: paneId="pane-1", command="tail -f /var/log/app.log"]
        Watching logs in pane-1...

Claude: [remote_session_share: permissions="view"]
        Shared session: http://localhost:3847/share/xyz789
        (Ops team can watch live)

Claude: [shell: sudo systemctl restart myapp]
        Service restarted.

Claude: [shell: //end]
        Session ended. App should be recovering.
```

## Architecture

```
┌─────────────────┐     ┌───────────────────────────────┐     ┌─────────────────┐
│   AI Client     │────▶│      Remote Shell MCP         │────▶│  Remote Server  │
│ (Claude Code)   │ MCP │          Server               │     │  (SSH/gcloud)   │
└─────────────────┘     └───────────────────────────────┘     └─────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                ┌───────────────┐       ┌───────────────┐
                │Session Manager│       │   Features    │
                │ - Sessions    │       │ - Blocks      │
                │ - Panes       │       │ - Persistence │
                │ - History     │       │ - Sharing     │
                └───────────────┘       │ - FileTransfer│
                                        │ - PortForward │
                                        │ - SmartWait   │
                                        └───────────────┘
                                                │
                                        ┌───────┴───────┐
                                        ▼               ▼
                                ┌───────────┐   ┌───────────┐
                                │ WebSocket │   │ Web Client│
                                │  Server   │──▶│ (Browser) │
                                └───────────┘   └───────────┘
```

### Module Structure

```
src/
├── index.ts              # MCP server entry point
├── session-manager.ts    # Session lifecycle management
├── types.ts              # TypeScript interfaces
├── features/
│   ├── blocks.ts         # Block-based output (v4.0)
│   ├── panes.ts          # Pane management (v4.0)
│   ├── persistence.ts    # Session persistence (v4.0)
│   ├── heartbeat.ts      # Connection monitoring (v4.0)
│   ├── sharing/          # Session sharing (v4.0)
│   │   ├── share-manager.ts
│   │   └── ws-server.ts
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
│   ├── port-tools.ts     # Port forward tools
│   ├── block-tools.ts    # Block tools (v4.0)
│   ├── pane-tools.ts     # Pane tools (v4.0)
│   └── share-tools.ts    # Share tools (v4.0)
├── prompts/
│   └── index.ts          # MCP prompts
└── utils/
    ├── ansi.ts           # Terminal formatting
    ├── terminal-ui.ts    # UI helpers
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

### Share server issues

- Default port is 3847
- Use `remote_share_server_start(port=XXXX)` to use a different port
- Check firewall allows connections

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Keywords**: MCP, Model Context Protocol, SSH, remote shell, AI tools, Claude, persistent sessions, terminal, DevOps, SFTP, port forwarding, cloud computing, tmux, panes, blocks, collaboration, sharing
