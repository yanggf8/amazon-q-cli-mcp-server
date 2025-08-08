# Amazon Q CLI MCP Server - Cursor Setup

Cursor has **native MCP support** through configuration files. This guide shows you how to set up our Amazon Q CLI MCP server with Cursor.

## Prerequisites

1. **Amazon Q CLI installed and working**:
   ```bash
   q --version
   q doctor
   ```

2. **Cursor installed** with MCP support

3. **Our MCP server built**:
   ```bash
   cd /home/yanggf/a/qcli
   npm run build
   npm install -g .
   ```

## Configuration Methods

### Method 1: Project-Specific (Recommended)

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "node",
      "args": ["/home/yanggf/a/qcli/dist/server.js"],
      "env": {}
    }
  }
}
```

**Benefits:**
- ✅ Project-specific tools
- ✅ Version control friendly
- ✅ Team sharing

### Method 2: Global Configuration

Create `~/.cursor/mcp.json` in your home directory:

```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

**Benefits:**
- ✅ Available in all projects
- ✅ Uses global npm package
- ✅ Simpler configuration

### Method 3: Using NPX (Alternative)

```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "npx",
      "args": ["-y", "amazon-q-mcp-server"],
      "env": {}
    }
  }
}
```

## Available Tools

Once configured, Cursor will have access to these Amazon Q tools:

1. **`ask_q`** - Chat with Amazon Q for technical assistance
2. **`q_translate`** - Convert natural language to shell commands
3. **`q_audit`** - Audit code for security and best practices
4. **`q_fix`** - Get fix suggestions for code issues

## Using MCP Tools in Cursor

### Automatic Tool Usage
Cursor's Composer Agent automatically uses MCP tools when relevant:

```
You: "Can you help me understand what AWS Lambda is?"
Cursor: [Automatically uses ask_q tool to get Amazon Q's explanation]

You: "I need a shell command to find all Python files"
Cursor: [Automatically uses q_translate tool]

You: "Review this code for security issues: const password = '123456';"
Cursor: [Automatically uses q_audit tool]
```

### Manual Tool Invocation
You can also request specific tools:

```
You: "Use Amazon Q to explain Docker containers"
You: "Ask Amazon Q to translate 'list running processes' to a shell command"
You: "Have Amazon Q audit this authentication code"
```

## Verification

### 1. Check MCP Server Status
In Cursor, the MCP tools should appear in the "Available Tools" section.

### 2. Test Tools
Try asking Cursor:
```
"Can you use Amazon Q to explain what microservices are?"
```

### 3. Debug Issues
If tools don't appear:

1. **Check configuration file syntax**:
   ```bash
   cat ~/.cursor/mcp.json | jq .
   ```

2. **Verify server works standalone**:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | amazon-q-mcp-server
   ```

3. **Check Cursor logs** for MCP connection errors

4. **Restart Cursor** after configuration changes

## Configuration Examples

### With Environment Variables
```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": [],
      "env": {
        "AWS_PROFILE": "my-profile",
        "AWS_REGION": "us-west-2"
      }
    }
  }
}
```

### Multiple Servers
```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": []
    },
    "other-server": {
      "command": "other-mcp-server",
      "args": []
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **"MCP server not found"**
   - Ensure `amazon-q-mcp-server` is in PATH
   - Use full path: `"command": "/full/path/to/server"`

2. **"Tools not appearing"**
   - Restart Cursor after configuration changes
   - Check JSON syntax with `jq`

3. **"Amazon Q CLI errors"**
   - Verify Q CLI works: `q doctor`
   - Check AWS credentials: `aws sts get-caller-identity`

4. **"Permission denied"**
   - Make server executable: `chmod +x /path/to/server`
   - Check file permissions

### Debug Commands

```bash
# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | amazon-q-mcp-server

# Validate JSON configuration
cat ~/.cursor/mcp.json | jq .

# Check if server is in PATH
which amazon-q-mcp-server

# Test Amazon Q CLI
q chat --no-interactive "test"
```

## Best Practices

1. **Use project-specific configuration** for team projects
2. **Version control** `.cursor/mcp.json` files
3. **Document required environment variables** in README
4. **Test configuration** after changes
5. **Use semantic versioning** for server updates

## Security Considerations

1. **Environment Variables**: Store sensitive data in env vars, not config files
2. **Local Execution**: MCP servers run locally with your permissions
3. **Code Review**: Review server code before deployment
4. **Minimal Permissions**: Use least-privilege AWS credentials

## Integration with Development Workflow

### Example: Code Review Workflow
```json
{
  "mcpServers": {
    "amazon-q-cli": {
      "command": "amazon-q-mcp-server",
      "args": [],
      "env": {
        "AWS_PROFILE": "development"
      }
    }
  }
}
```

Then in Cursor:
```
You: "Review this pull request for security issues and best practices"
Cursor: [Uses q_audit tool to analyze code with Amazon Q]
```

This setup provides seamless integration between Cursor and Amazon Q CLI, enabling powerful AI-assisted development workflows.
