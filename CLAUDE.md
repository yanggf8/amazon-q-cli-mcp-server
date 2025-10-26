# Amazon Q CLI MCP Server - Claude Integration

This document provides specific guidance for integrating the Amazon Q CLI MCP Server with Claude Desktop and other MCP hosts.

## Claude Desktop Setup

### 1. Install the Server
```bash
npm install -g amazon-q-cli-mcp-server
```

### 2. Configure Claude Desktop

Edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": []
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the MCP server.

## Rovo Dev CLI Setup

### 1. Configure MCP Server
Add to `~/.rovodev/mcp.json`:

```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": [],
      "transport": "stdio"
    }
  }
}
```

### 2. Handle GLIBC Conflicts (if needed)
If you encounter GLIBC version conflicts, create a wrapper script:

```bash
#!/bin/bash
# Clear LD_LIBRARY_PATH to avoid conflicts
unset LD_LIBRARY_PATH
exec amazon-q-mcp-server "$@"
```

Make it executable and use the wrapper path in your configuration.

## Available Tools

### 🤖 ask_q / take_q
Ask Amazon Q for AI assistance on any topic.

### 🔄 q_translate  
Convert natural language to shell commands.

### 📊 q_status
Check Amazon Q CLI status and configuration.

### 🌐 fetch_chunk
Fetch specific byte ranges from URLs.

## Usage Examples

### Getting Code Help
```
Use ask_q to help me write a Python function that processes CSV files
```

### Command Translation
```
Use q_translate to convert: "compress all log files older than 30 days"
```

### Status Check
```
Use q_status to check if Amazon Q CLI is properly configured
```

## Troubleshooting

### Normal Startup Messages
```
[Amazon Q MCP] init Amazon Q CLI MCP Server
[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio
```

### Common Issues

**Tool Not Available:**
1. Check configuration file syntax
2. Ensure `amazon-q-mcp-server` is in your PATH
3. Restart the MCP host after configuration changes

**GLIBC Conflicts (Rovo Dev CLI):**
Create a wrapper script that clears `LD_LIBRARY_PATH`

**Authentication Issues:**
1. Run `q --version` to check Q CLI installation
2. Verify AWS credentials are configured
3. Ensure Amazon Q permissions

## Claude Code CLI Integration

```bash
claude mcp add -s user amazon-q-cli amazon-q-mcp-server
```

## Best Practices

1. **Use Specific Prompts**: More specific questions get better responses
2. **Context Matters**: The server maintains session context
3. **Check Status First**: Use `q_status` if you encounter issues
4. **Leverage Translation**: Use `q_translate` for complex commands
