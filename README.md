# Amazon Q CLI MCP Server

A Model Context Protocol (MCP) server that wraps the Amazon Q CLI, enabling MCP hosts (Claude Desktop, VS Code, etc.) to interact with Amazon Q's AI capabilities.

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

### From npm (when published)
```bash
npm install -g amazon-q-cli-mcp-server
```

### From source
```bash
git clone <repository>
cd amazon-q-cli-mcp-server
npm install
npm run build
```

## Usage

### Claude Desktop
Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Claude Code CLI
```bash
npm run build
claude mcp add -s user amazon-q-cli node /path/to/dist/server.js
```

## Available Tools

### ask_q / take_q
Chat with Amazon Q CLI for AI assistance.

**Parameters:**
- `prompt` (required): Question or prompt for Amazon Q
- `model` (optional): Model to use
- `agent` (optional): Agent/context profile

**Example:**
```json
{
  "name": "ask_q",
  "arguments": {
    "prompt": "How do I create an S3 bucket?",
    "model": "claude-3-sonnet"
  }
}
```

### q_translate
Convert natural language to shell commands.

**Parameters:**
- `task` (required): Natural language description

**Example:**
```json
{
  "name": "q_translate",
  "arguments": {
    "task": "find all Python files in current directory"
  }
}
```

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

## Security Features

- **Input Validation**: Length limits and sanitization
- **Command Whitelisting**: Only allowed Q CLI commands
- **Resource Limits**: Timeouts and output size limits
- **Path Protection**: Session ID sanitization prevents traversal

## Session Management

- **Automatic Persistence**: Conversations continue across tool calls
- **Session Isolation**: Each MCP connection gets unique history
- **Directory Mapping**: Sessions stored in `~/.amazon-q-mcp/sessions/`
- **Logging**: Comprehensive session-based logging

## Troubleshooting

### Normal Startup Messages
```
[Amazon Q MCP] init Amazon Q CLI MCP Server
[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio
```
These are expected initialization messages.

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

**Permissions:**
Ensure AWS credentials have Amazon Q service permissions.

## Development

```bash
npm run build    # Build TypeScript
npm run dev      # Watch mode
npm test         # Run tests
npm run test:all # Include integration tests
```

## Architecture

```
MCP Host (Claude Desktop, VS Code, etc.)
    ↓ (MCP Protocol)
Amazon Q CLI MCP Server
    ↓ (Process execution with security)
Amazon Q CLI (`q` command)
    ↓ (AWS API calls)
Amazon Q Service
```

## License

Apache License 2.0 - see LICENSE file for details.
