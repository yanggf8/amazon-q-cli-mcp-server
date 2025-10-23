# Amazon Q CLI MCP Server - Claude Integration

This document provides specific guidance for integrating the Amazon Q CLI MCP Server with Claude Desktop and Claude Code CLI.

## Claude Desktop Setup

### 1. Install the Server
```bash
npm install -g amazon-q-cli-mcp-server
# or build from source
git clone <repository>
cd amazon-q-cli-mcp-server
npm install && npm run build
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

## Available Tools in Claude

Once configured, you'll have access to these tools:

### 🤖 ask_q / take_q
Ask Amazon Q for AI assistance on any topic.
```
Can you help me optimize this Python code for performance?
```

### 🔄 q_translate  
Convert natural language to shell commands.
```
Translate: "find all JavaScript files modified in the last week"
```

### 📊 q_status
Check Amazon Q CLI status and configuration.

### 🌐 fetch_chunk
Fetch specific byte ranges from URLs (useful for large files).

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

### Tool Not Available
1. Check Claude Desktop configuration file syntax
2. Ensure `amazon-q-mcp-server` is in your PATH
3. Restart Claude Desktop after configuration changes

### Authentication Issues
1. Run `q status` in terminal to check Q CLI authentication
2. Use `q login` to re-authenticate if needed
3. Verify AWS credentials are properly configured

### Permission Errors
Ensure your AWS credentials have the necessary Amazon Q permissions:
- `amazonq:*` permissions for full access
- Or specific permissions based on your use case

## Session Management

The server automatically manages conversation sessions:
- Each Claude conversation gets a unique session
- Context is preserved across multiple tool calls
- Sessions are stored in `~/.amazon-q-mcp/sessions/`

## Security Notes

- All inputs are validated and sanitized
- Only whitelisted Q CLI commands are allowed
- Resource limits prevent abuse (timeouts, size limits)
- Session IDs are sanitized to prevent path traversal

## Claude Code CLI Integration

For Claude Code CLI users:

```bash
# Build the server
npm run build

# Add to Claude Code CLI
claude mcp add -s user amazon-q-cli node /path/to/dist/server.js

# Verify installation
claude mcp list
```

## Best Practices

1. **Use Specific Prompts**: More specific questions get better responses
2. **Context Matters**: The server maintains session context for follow-up questions
3. **Check Status First**: Use `q_status` if you encounter issues
4. **Leverage Translation**: Use `q_translate` for complex command construction

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify Amazon Q CLI is working independently
3. Check Claude Desktop logs for MCP-related errors
4. Ensure all prerequisites are met (Node.js 18+, AWS credentials, Q CLI)
