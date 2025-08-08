# Amazon Q CLI MCP Server Usage Examples

This document provides examples of how to use the Amazon Q CLI MCP Server with different MCP hosts.

## Claude Desktop Integration

### Configuration

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

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

### Example Conversations

Once configured, you can use Amazon Q CLI through Claude Desktop:

**Example 1: Getting Help**
```
User: Can you help me understand what Amazon Q CLI can do?

Claude: I'll check what Amazon Q CLI can do for you.

[Uses q_get_help tool]

Based on the Amazon Q CLI help, here's what it can do:
- Interactive chat sessions for AWS-related questions
- Code analysis and suggestions
- Infrastructure recommendations
- Best practices guidance
- And more...
```

**Example 2: Checking AWS Configuration**
```
User: Can you check if my AWS credentials are properly configured?

Claude: I'll check your AWS configuration and Amazon Q CLI status.

[Uses q_check_status tool]

Your Amazon Q CLI is installed and working. Here's your current AWS configuration:
- AWS CLI version: 2.x.x
- Current identity: arn:aws:iam::123456789012:user/your-username
- Default region: us-east-1
```

**Example 3: Interactive Chat**
```
User: Ask Amazon Q how to create a secure S3 bucket with encryption

Claude: I'll ask Amazon Q about creating a secure S3 bucket with encryption.

[Uses q_chat tool with message: "How do I create a secure S3 bucket with encryption?"]

Amazon Q recommends the following approach for creating a secure S3 bucket:

1. Enable server-side encryption (SSE)
2. Block public access
3. Enable versioning
4. Configure access logging
5. Use bucket policies for fine-grained access control

Here's an example AWS CLI command:
```bash
aws s3api create-bucket --bucket my-secure-bucket --region us-east-1
aws s3api put-bucket-encryption --bucket my-secure-bucket --server-side-encryption-configuration ...
```
```

## VS Code Integration

If you're using VS Code with an MCP extension, you can configure it similarly:

```json
{
  "mcp.servers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": []
    }
  }
}
```

## Direct MCP Protocol Usage

You can also interact with the server directly using the MCP protocol over stdio:

### List Available Tools

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "q_chat",
        "description": "Start an interactive chat session with Amazon Q CLI",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": {
              "type": "string",
              "description": "The message to send to Amazon Q"
            },
            "profile": {
              "type": "string",
              "description": "AWS profile to use (optional)"
            },
            "region": {
              "type": "string",
              "description": "AWS region to use (optional)"
            }
          },
          "required": ["message"]
        }
      }
      // ... other tools
    ]
  }
}
```

### Call a Tool

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "q_chat",
    "arguments": {
      "message": "How do I optimize my Lambda function for better performance?",
      "region": "us-west-2"
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Amazon Q Response:\n\nTo optimize your Lambda function for better performance:\n\n1. Right-size your memory allocation\n2. Minimize cold starts\n3. Use provisioned concurrency for consistent performance\n4. Optimize your code and dependencies\n5. Consider using Lambda layers for shared libraries\n..."
      }
    ]
  }
}
```

## Advanced Usage

### Using Different AWS Profiles

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "q_chat",
    "arguments": {
      "message": "Show me my current EC2 instances",
      "profile": "production",
      "region": "eu-west-1"
    }
  }
}
```

### Executing Specific Q CLI Commands

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "q_execute_command",
    "arguments": {
      "command": "help",
      "args": ["chat", "--verbose"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **"Q CLI not found" error**
   - Ensure Amazon Q CLI is installed: `npm install -g @aws/amazon-q-cli`
   - Verify it's in your PATH: `which q`

2. **AWS credentials not configured**
   - Run `aws configure` to set up credentials
   - Or set environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

3. **Permission errors**
   - Ensure your AWS credentials have the necessary permissions for Amazon Q
   - Check your IAM policies

### Debug Mode

To run the server with debug output:

```bash
DEBUG=1 node dist/server.js
```

This will provide additional logging to help diagnose issues.
