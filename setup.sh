#!/bin/bash

# Setup script for Remote Shell MCP server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up Remote Shell MCP server..."

cd "$SCRIPT_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Make the output executable
chmod +x dist/index.js

echo ""
echo "Build complete!"
echo ""
echo "To add this MCP server to Claude Code, run:"
echo ""
echo "  claude mcp add remote-shell node $SCRIPT_DIR/dist/index.js"
echo ""
echo "Or add it manually to ~/.claude/settings.json:"
echo ""
cat << 'EOF'
{
  "mcpServers": {
    "remote-shell": {
      "command": "node",
      "args": ["$SCRIPT_DIR/dist/index.js"]
    }
  }
}
EOF
echo ""
echo "(Replace \$SCRIPT_DIR with: $SCRIPT_DIR)"
echo ""
