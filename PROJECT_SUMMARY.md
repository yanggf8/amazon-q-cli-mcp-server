# Amazon Q CLI MCP Server - Project Summary

## Overview

This project implements a Model Context Protocol (MCP) server that wraps the Amazon Q CLI, allowing MCP hosts (Claude Desktop, Rovo Dev CLI, VS Code, etc.) to interact with Amazon Q's AI capabilities through a secure, well-tested interface.

## Architecture

### Core Components

**MCP Server (`src/server.ts`)**
- Full MCP Protocol compliance with JSON-RPC 2.0
- Amazon Q CLI integration with proper argument handling
- Comprehensive error handling with user-friendly messages
- TypeScript implementation with Zod validation schemas

**Session Logger (`src/session-logger.ts`)**
- Session-based logging with automatic cleanup
- Process tracking and resource management
- Comprehensive activity logging for debugging

### Available Tools

1. **ask_q / take_q**: Chat interface to Amazon Q CLI
   - Parameters: `prompt` (required), `model`, `agent`
   - Supports conversation context and session persistence

2. **q_translate**: Natural language to shell command translation
   - Parameters: `task` (required)
   - Converts descriptions to executable commands

3. **q_status**: System status and configuration check
   - No parameters required
   - Reports server uptime and Q CLI status

4. **fetch_chunk**: HTTP byte range fetching utility
   - Parameters: `url` (required), `start`, `length`, `headers`
   - Useful for downloading specific parts of large files

## Security Features

### Input Validation & Sanitization
- **Length Limits**: Prompts limited to 10,000 characters
- **Session ID Sanitization**: Prevents path traversal attacks
- **Command Whitelisting**: Only approved Q CLI commands allowed
- **Parameter Validation**: Zod schemas ensure type safety

### Resource Protection
- **Timeouts**: 30-second limit on command execution
- **Output Limits**: 1MB maximum output size per command
- **Process Management**: Proper cleanup of child processes
- **Memory Protection**: Prevents unbounded memory growth

### Error Handling
- **Classified Errors**: Structured error types with guidance
- **Retry Logic**: Exponential backoff for transient failures
- **User-Friendly Messages**: Clear error descriptions and actions

## Supported MCP Hosts

### Claude Desktop
- Standard MCP configuration
- Cross-platform support (macOS, Windows, Linux)

### Rovo Dev CLI
- Full integration with transport specification
- GLIBC conflict resolution with wrapper scripts
- Signature-based server validation

### Claude Code CLI
- Command-line MCP server management
- User and system-level configurations

## Session Management

### Features
- **Automatic Persistence**: Conversations continue across tool calls
- **Session Isolation**: Each MCP connection gets unique context
- **Directory Structure**: `~/.amazon-q-mcp/sessions/{sessionId}/`
- **Activity Logging**: Comprehensive session-based logs

### Security
- **Path Sanitization**: Session IDs cleaned to prevent traversal
- **Resource Limits**: Automatic cleanup of old sessions
- **Process Tracking**: All child processes properly managed

## Deployment

### Prerequisites
- Node.js 18+
- Amazon Q CLI installed and configured
- AWS credentials with Q service permissions

### Installation
```bash
npm install -g amazon-q-cli-mcp-server
```

### Configuration Examples

**Claude Desktop:**
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

**Rovo Dev CLI:**
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

## Troubleshooting

### Common Issues

**GLIBC Conflicts (Rovo Dev CLI):**
- Create wrapper script that clears `LD_LIBRARY_PATH`
- Use wrapper script path in configuration

**Authentication Issues:**
- Verify Q CLI installation: `q --version`
- Check AWS credentials configuration
- Ensure Amazon Q service permissions

**Startup Messages:**
```
[Amazon Q MCP] init Amazon Q CLI MCP Server
[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio
```

## Development

### Build Process
```bash
npm run build    # TypeScript compilation
npm run dev      # Watch mode for development
npm test         # Run test suite
```

### Code Quality
- **TypeScript**: Full type safety with strict mode
- **Zod**: Runtime type validation
- **Vitest**: Modern testing framework

## Performance

### Resource Usage
- **Memory**: Minimal baseline, bounded by output limits
- **CPU**: Low overhead, mainly I/O bound
- **Storage**: Session logs in `~/.amazon-q-mcp/`

### Scalability
- **Concurrent Sessions**: Supports multiple MCP connections
- **Process Management**: Efficient child process handling
- **Error Recovery**: Automatic retry with backoff

## License

Apache License 2.0 - see LICENSE file for details.
