# Installing Amazon Q CLI MCP Server with Gemini CLI

## Prerequisites

1. **Gemini CLI installed**:
   ```bash
   # Install Gemini CLI
   npm install -g @google/gemini-cli
   # OR
   npx https://github.com/google-gemini/gemini-cli
   ```

2. **Amazon Q CLI installed and configured**:
   ```bash
   q --version
   aws configure  # Ensure AWS credentials are set
   ```

3. **Our MCP Server built**:
   ```bash
   cd /home/yanggf/a/qcli
   npm install
   npm run build
   ```

## Installation Steps

### Step 1: Configure Gemini CLI Settings

1. **Find or create Gemini CLI settings file**:
   - Global: `~/.gemini/settings.json`
   - Project: `.gemini/settings.json` in your project directory

2. **Add MCP server configuration**:
   ```json
   {
     "mcpServers": {
       "amazon-q-cli": {
         "command": "node",
         "args": ["/home/yanggf/a/qcli/dist/server.js"],
         "timeout": 30000,
         "trust": false
       }
     }
   }
   ```

### Step 2: Test the Configuration

```bash
# Start Gemini CLI
gemini

# In the Gemini CLI, check MCP servers
/mcp

# You should see the amazon-q-cli server listed
```

### Step 3: Use Amazon Q Tools

In the Gemini CLI chat, you can now use Amazon Q functionality:

```
User: Can you use the Amazon Q tools to explain what AWS S3 is?

Gemini: I'll use the Amazon Q CLI to get information about AWS S3.
[Uses q_chat tool]

Based on Amazon Q's response, AWS S3 (Simple Storage Service) is...
```

## Available Commands in Gemini CLI

### MCP Management Commands
```bash
# List all MCP servers and their status
/mcp

# Add a new MCP server
/mcp add amazon-q-cli node /path/to/server.js

# Remove an MCP server
/mcp remove amazon-q-cli

# List available MCP servers
/mcp list
```

### Using Amazon Q Tools
The Gemini model will automatically discover and use these tools:
- `q_chat` - Chat with Amazon Q
- `q_translate` - Translate natural language to shell commands
- `q_doctor` - Run diagnostics
- `q_get_help` - Get help information
- `q_check_status` - Check Amazon Q CLI status

## Example Usage Session

```bash
$ gemini

> Can you check if Amazon Q CLI is working properly?

[Gemini uses q_check_status tool]
✓ Amazon Q CLI Status: q 1.13.1
✓ Everything looks good!

> Ask Amazon Q how to create a secure S3 bucket

[Gemini uses q_chat tool with message about S3 bucket security]
Amazon Q recommends:
1. Enable server-side encryption
2. Block public access
3. Enable versioning
...

> Translate "find all Python files" to a shell command

[Gemini uses q_translate tool]
Shell command: find . -name "*.py" -type f
```

## Troubleshooting

### MCP Server Not Appearing
```bash
# Check if the server path is correct
ls -la /home/yanggf/a/qcli/dist/server.js

# Test the server manually
node /home/yanggf/a/qcli/dist/server.js
# Should output: "Amazon Q CLI MCP Server running on stdio"
```

### Permission Issues
```bash
# Ensure the server is executable
chmod +x /home/yanggf/a/qcli/dist/server.js

# Check Node.js can run it
node --version
```

### Amazon Q CLI Issues
```bash
# Test Amazon Q CLI directly
q doctor
q --help

# Check AWS credentials
aws sts get-caller-identity
```
