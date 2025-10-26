# Amazon Q CLI MCP Server - Usage Examples

This document provides practical examples of using the Amazon Q CLI MCP Server with various MCP hosts.

## Configuration Examples

### Claude Desktop
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

### With Wrapper Script (for GLIBC conflicts)
```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "/path/to/wrapper-script.sh",
      "args": [],
      "transport": "stdio"
    }
  }
}
```

## Usage Examples

### Basic Q&A
```
Use ask_q to help me understand how to optimize a Python function for better performance
```

### Command Translation
```
Use q_translate to convert: "find all JavaScript files modified in the last 7 days and count the lines of code"
```

### System Status Check
```
Use q_status to check if Amazon Q CLI is properly configured and working
```

### Fetching Documentation
```
Use fetch_chunk to get the first 1000 bytes from https://docs.aws.amazon.com/amazonq/latest/api-reference/
```

## Tool Parameters

### ask_q / take_q
```json
{
  "name": "ask_q",
  "arguments": {
    "prompt": "How do I create a secure S3 bucket with encryption?",
    "model": "claude-3-sonnet",
    "agent": "aws-expert"
  }
}
```

### q_translate
```json
{
  "name": "q_translate",
  "arguments": {
    "task": "compress all log files older than 30 days in /var/log"
  }
}
```

### q_status
```json
{
  "name": "q_status",
  "arguments": {}
}
```

### fetch_chunk
```json
{
  "name": "fetch_chunk",
  "arguments": {
    "url": "https://example.com/large-file.json",
    "start": 0,
    "length": 1024,
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

## Common Use Cases

### Code Review and Optimization
1. Use `ask_q` to get code review suggestions
2. Follow up with specific optimization questions
3. Use `q_translate` to get shell commands for testing

### Infrastructure Management
1. Use `ask_q` for AWS best practices
2. Use `q_translate` to convert requirements to CLI commands
3. Use `q_status` to verify tool availability

### Documentation and Learning
1. Use `fetch_chunk` to get specific sections of documentation
2. Use `ask_q` to explain complex concepts
3. Use `q_translate` for practical command examples

## Troubleshooting

### Normal Startup Messages
```
[Amazon Q MCP] init Amazon Q CLI MCP Server
[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio
```

### GLIBC Conflicts (Rovo Dev CLI)
If you see GLIBC version errors, use the wrapper script:
```bash
#!/bin/bash
unset LD_LIBRARY_PATH
exec amazon-q-mcp-server "$@"
```

### Authentication Issues
1. Run `q --version` to check Q CLI installation
2. Verify AWS credentials are configured
3. Ensure Amazon Q permissions

## Best Practices

### Effective Prompts
- Be specific about your requirements
- Provide context about your environment
- Ask follow-up questions to refine answers

### Resource Management
- The server automatically limits output size and execution time
- Sessions are cleaned up automatically
- Use `q_status` to monitor system health
