# Amazon Q CLI MCP Server - Project Summary

## Overview

This project implements a Model Context Protocol (MCP) server that wraps the Amazon Q CLI, allowing MCP hosts (Claude Desktop, VS Code, etc.) to interact with Amazon Q's AI capabilities through a secure, well-tested interface.

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

## Testing

### Test Coverage
- **Unit Tests**: Core functionality and error handling
- **Integration Tests**: MCP protocol compliance
- **Mock Testing**: Child process execution simulation
- **Security Tests**: Input validation and sanitization

### Test Results
```
✓ src/server.test.ts (7 tests)
✓ src/mcp-protocol.test.ts (3 tests)
Test Files: 2 passed
Tests: 10 passed
```

## Development Workflow

### Build Process
```bash
npm run build    # TypeScript compilation
npm run dev      # Watch mode for development
npm test         # Run test suite
npm run test:all # Include integration tests
```

### Code Quality
- **TypeScript**: Full type safety with strict mode
- **ESLint**: Code style and quality enforcement
- **Vitest**: Modern testing framework
- **Zod**: Runtime type validation

## Deployment

### Prerequisites
- Node.js 18+
- Amazon Q CLI installed and configured
- AWS credentials with Q service permissions

### Installation Options
1. **NPM Package** (when published): `npm install -g amazon-q-cli-mcp-server`
2. **From Source**: Clone, install, build, and configure PATH

### Configuration
- **Claude Desktop**: Add to `claude_desktop_config.json`
- **Claude Code CLI**: Use `claude mcp add` command
- **Other MCP Hosts**: Standard MCP server configuration

## Performance Characteristics

### Resource Usage
- **Memory**: Minimal baseline, bounded by output limits
- **CPU**: Low overhead, mainly I/O bound
- **Network**: Depends on Q CLI usage patterns
- **Storage**: Session logs in `~/.amazon-q-mcp/`

### Scalability
- **Concurrent Sessions**: Supports multiple MCP connections
- **Process Management**: Efficient child process handling
- **Error Recovery**: Automatic retry with backoff
- **Resource Cleanup**: Proper cleanup on shutdown

## Future Enhancements

### Potential Improvements
1. **Streaming Responses**: Real-time output for long operations
2. **Advanced Caching**: Response caching for repeated queries
3. **Plugin System**: Extensible tool architecture
4. **Metrics Collection**: Usage analytics and performance monitoring

### Maintenance
- **Log Rotation**: Automatic cleanup of old session logs
- **Health Monitoring**: Built-in diagnostics and status reporting
- **Update Mechanism**: Graceful handling of Q CLI updates

## License & Support

- **License**: Apache License 2.0
- **Documentation**: Comprehensive README and setup guides
- **Troubleshooting**: Detailed error messages and guidance
- **Community**: Open source with contribution guidelines
