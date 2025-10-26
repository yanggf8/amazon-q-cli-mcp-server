# Amazon Q CLI MCP Server

A Model Context Protocol (MCP) server that wraps the Amazon Q CLI, enabling MCP hosts (Claude Desktop, VS Code, Rovo Dev CLI, etc.) to interact with Amazon Q's AI capabilities.

## Features

- **ask_q / take_q**: Chat with Amazon Q CLI for AI assistance
- **q_translate**: Convert natural language to shell commands
- **q_status**: Check Amazon Q CLI installation and configuration
- **fetch_chunk**: Fetch byte ranges from HTTP URLs
- **Session Management**: Automatic session persistence with conversation history
- **Error Recovery**: Intelligent retry logic with exponential backoff
- **Security**: Input validation, command whitelisting, and resource limits

## Prerequisites

- **Amazon Q CLI**: Install from [AWS documentation](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-getting-started.html)
- **AWS Credentials**: Configure via `aws configure` or environment variables
- **Node.js**: Version 18 or higher

## Installation

### From npm
```bash
npm install -g amazon-q-cli-mcp-server
```

### From source
```bash
git clone <repository>
cd amazon-q-cli-mcp-server
npm install
npm run build
npm install -g .
```

## Usage

### Claude Desktop
Add to `claude_desktop_config.json`:

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

### Rovo Dev CLI
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

**Note**: If you encounter GLIBC version conflicts with Rovo Dev CLI, create a wrapper script:

```bash
#!/bin/bash
# Clear LD_LIBRARY_PATH to avoid conflicts
unset LD_LIBRARY_PATH
exec amazon-q-mcp-server "$@"
```

Then use the wrapper script path in your configuration.

### Claude Code CLI
```bash
claude mcp add -s user amazon-q-cli amazon-q-mcp-server
```

## Available Tools

### ask_q / take_q
Chat with Amazon Q CLI for AI assistance.

**Parameters:**
- `prompt` (required): Question or prompt for Amazon Q
- `model` (optional): Model to use
- `agent` (optional): Agent/context profile

### q_translate
Convert natural language to shell commands.

**Parameters:**
- `task` (required): Natural language description

### q_status
Check Amazon Q CLI installation and configuration.

**Parameters:** None

### fetch_chunk
Fetch byte ranges from HTTP URLs.

**Parameters:**
- `url` (required): HTTP/HTTPS URL
- `start` (optional): Start byte offset (default: 0)
- `length` (optional): Bytes to fetch (default: 65536, max: 10MB)
- `headers` (optional): Request headers

## Troubleshooting

### Normal Startup Messages
```
[Amazon Q MCP] init Amazon Q CLI MCP Server
[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio
```

### Common Issues

**Q CLI not found:**
```bash
which q
q --version
```

**AWS credentials:**
```bash
aws configure
# or set environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-west-2
```

**GLIBC version conflicts (Rovo Dev CLI):**
Create a wrapper script that clears `LD_LIBRARY_PATH` before executing the server.

**MCP server not starting:**
- Check that the command path is correct
- Verify Node.js is accessible
- Ensure proper permissions on executable files

## Development

```bash
npm run build    # Build TypeScript
npm run dev      # Watch mode
npm test         # Run tests
```

## Architecture

```
MCP Host (Claude Desktop, Rovo Dev CLI, etc.)
    ↓ (MCP Protocol)
Amazon Q CLI MCP Server
    ↓ (Process execution with security)
Amazon Q CLI (`q` command)
    ↓ (AWS API calls)
Amazon Q Service
```

## License

Apache License 2.0 - see LICENSE file for details.
