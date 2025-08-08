# Amazon Q CLI MCP Server

This is a Model Context Protocol (MCP) server that wraps the Amazon Q CLI, allowing other MCP hosts (like Claude Desktop, VS Code with MCP extension, etc.) to interact with Amazon Q's capabilities.

## Features

The MCP server provides the following tools:

- **q_chat**: Start an interactive chat session with Amazon Q CLI
- **q_execute_command**: Execute any Amazon Q CLI command with specific parameters
- **q_get_help**: Get help information for Amazon Q CLI commands
- **q_list_profiles**: List available AWS profiles
- **q_check_status**: Check Amazon Q CLI installation and configuration status

## Prerequisites

1. **Amazon Q CLI**: Make sure the Amazon Q CLI (`q`) is installed and accessible in your PATH
2. **AWS Configuration**: Ensure AWS credentials are configured (via `aws configure` or environment variables)
3. **Node.js**: Version 18 or higher

## Installation

### Option 1: Install from npm (when published)

```bash
npm install -g amazon-q-cli-mcp-server
```

### Option 2: Build from source

```bash
git clone <this-repository>
cd amazon-q-cli-mcp-server
npm install
npm run build
```

## Usage

### With Claude Desktop

Add the following to your Claude Desktop MCP configuration file:

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

If you built from source, use the full path:

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

### With Other MCP Hosts

The server uses stdio transport, so it can be used with any MCP host that supports stdio. Configure it according to your host's documentation.

## Available Tools

### q_chat

Start a chat session with Amazon Q CLI.

**Parameters:**
- `message` (required): The message to send to Amazon Q
- `profile` (optional): AWS profile to use
- `region` (optional): AWS region to use

**Example:**
```json
{
  "name": "q_chat",
  "arguments": {
    "message": "How do I create an S3 bucket using AWS CLI?",
    "profile": "my-profile",
    "region": "us-west-2"
  }
}
```

### q_execute_command

Execute a specific Amazon Q CLI command.

**Parameters:**
- `command` (required): The Q CLI command to execute
- `args` (optional): Additional arguments for the command
- `profile` (optional): AWS profile to use
- `region` (optional): AWS region to use

**Example:**
```json
{
  "name": "q_execute_command",
  "arguments": {
    "command": "help",
    "args": ["chat"]
  }
}
```

### q_get_help

Get help information for Amazon Q CLI commands.

**Parameters:**
- `command` (optional): Specific command to get help for

**Example:**
```json
{
  "name": "q_get_help",
  "arguments": {
    "command": "chat"
  }
}
```

### q_list_profiles

List available AWS profiles.

**Parameters:** None

### q_check_status

Check Amazon Q CLI installation and configuration status.

**Parameters:** None

## Configuration

The server automatically detects your AWS configuration and Amazon Q CLI installation. Make sure:

1. Amazon Q CLI is installed and the `q` command is available in your PATH
2. AWS credentials are configured (via `aws configure`, environment variables, or IAM roles)
3. You have the necessary permissions to use Amazon Q

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Troubleshooting

### "Q CLI not found" error

Make sure the Amazon Q CLI is installed and accessible:

```bash
which q
q --version
```

### AWS credentials not configured

Configure your AWS credentials:

```bash
aws configure
```

Or set environment variables:

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-west-2
```

### Permission errors

Ensure your AWS credentials have the necessary permissions to use Amazon Q services.

## Architecture

This MCP server acts as a bridge between MCP hosts and the Amazon Q CLI:

```
MCP Host (Claude Desktop, VS Code, etc.)
    ↓ (MCP Protocol)
Amazon Q CLI MCP Server
    ↓ (Process execution)
Amazon Q CLI (`q` command)
    ↓ (AWS API calls)
Amazon Q Service
```

The server:
1. Receives MCP tool calls from the host
2. Translates them into appropriate `q` CLI commands
3. Executes the commands and captures output
4. Returns formatted responses back to the MCP host

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Related Projects

- [Amazon Q CLI](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-getting-started.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Gemini CLI MCP Implementation](https://github.com/google-gemini/gemini-cli) (inspiration for this project)
