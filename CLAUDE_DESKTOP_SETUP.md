# Installing Amazon Q CLI MCP Server with Claude Desktop

## Prerequisites

1. **Amazon Q CLI installed and working**:
   ```bash
   # Check if Q CLI is installed
   q --version
   
   # If not installed, install it first
   npm install -g @aws/amazon-q-cli
   ```

2. **AWS credentials configured**:
   ```bash
   # Configure AWS credentials
   aws configure
   # OR set environment variables
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_DEFAULT_REGION=us-west-2
   ```

3. **Node.js 18+ installed**

## Installation Steps

### Step 1: Install the MCP Server

```bash
# Clone and build from source
git clone <your-repository-url>
cd amazon-q-cli-mcp-server
npm install
npm run build

# Make it globally accessible (optional)
npm link
```

### Step 2: Configure Claude Desktop

1. **Find your Claude Desktop config file**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. **Add the MCP server configuration**:

   If using npm link:
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

   If using local build:
   ```json
   {
     "mcpServers": {
       "amazon-q-cli": {
         "command": "node",
         "args": ["/path/to/amazon-q-cli-mcp-server/dist/server.js"]
       }
     }
   }
   ```

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

### Step 4: Test the Integration

In Claude Desktop, you should now be able to ask questions like:

- "Can you check if Amazon Q CLI is working properly?"
- "Ask Amazon Q to explain what AWS Lambda is"
- "Use Amazon Q to translate 'list all files' to a shell command"

Claude will automatically use the appropriate MCP tools to interact with Amazon Q CLI.

## Troubleshooting

### Server Not Loading
1. Check Claude Desktop logs for errors
2. Verify the path to the server is correct
3. Ensure Amazon Q CLI is accessible: `which q`

### Permission Issues
```bash
# Make sure the server script is executable
chmod +x /path/to/amazon-q-cli-mcp-server/dist/server.js
```

### AWS Credentials Issues
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Amazon Q CLI
q doctor
```
