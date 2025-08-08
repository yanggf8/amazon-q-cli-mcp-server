#!/usr/bin/env node

/**
 * Cursor Agent Integration for Amazon Q CLI MCP Server
 * 
 * This script provides Amazon Q capabilities to cursor-agent by acting as a bridge
 * between cursor-agent and our MCP server.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

class CursorAgentAmazonQBridge {
  constructor() {
    this.mcpServer = null;
    this.startMCPServer();
  }

  startMCPServer() {
    this.mcpServer = spawn('amazon-q-mcp-server', [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.mcpServer.stderr.on('data', (data) => {
      console.error('MCP Server:', data.toString());
    });

    this.mcpServer.on('error', (error) => {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    });
  }

  async callMCPTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      let response = '';
      
      const onData = (data) => {
        response += data.toString();
        try {
          const parsed = JSON.parse(response);
          if (parsed.result) {
            this.mcpServer.stdout.off('data', onData);
            resolve(parsed.result.content[0].text);
          }
        } catch (e) {
          // Continue collecting data
        }
      };

      this.mcpServer.stdout.on('data', onData);
      this.mcpServer.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        this.mcpServer.stdout.off('data', onData);
        reject(new Error('Timeout waiting for MCP response'));
      }, 30000);
    });
  }

  async askAmazonQ(prompt) {
    try {
      return await this.callMCPTool('ask_q', { prompt });
    } catch (error) {
      return `Error asking Amazon Q: ${error.message}`;
    }
  }

  async translateToShell(task) {
    try {
      return await this.callMCPTool('q_translate', { task });
    } catch (error) {
      return `Error translating: ${error.message}`;
    }
  }

  async auditCode(code, language = '') {
    try {
      return await this.callMCPTool('q_audit', { code, language });
    } catch (error) {
      return `Error auditing code: ${error.message}`;
    }
  }

  async fixCode(code, issue) {
    try {
      return await this.callMCPTool('q_fix', { code, issue });
    } catch (error) {
      return `Error getting fix: ${error.message}`;
    }
  }

  showHelp() {
    return `
Amazon Q CLI Integration for Cursor Agent

Available commands:
  ask <question>           - Ask Amazon Q a question
  translate <task>         - Convert natural language to shell command
  audit <code>            - Audit code for issues
  fix <code> <issue>      - Get fix suggestions for code issues
  help                    - Show this help
  quit                    - Exit

Examples:
  ask What is AWS Lambda?
  translate find all Python files
  audit const password = "123456";
  fix console.log(user.name) TypeError: Cannot read property 'name' of undefined
`;
  }

  async start() {
    console.log('🚀 Amazon Q CLI Bridge for Cursor Agent');
    console.log('Type "help" for available commands, "quit" to exit\n');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'amazon-q> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      
      if (!input) {
        rl.prompt();
        return;
      }

      const [command, ...args] = input.split(' ');
      const argument = args.join(' ');

      try {
        switch (command.toLowerCase()) {
          case 'ask':
            if (!argument) {
              console.log('Usage: ask <question>');
            } else {
              console.log('🤖 Asking Amazon Q...\n');
              const response = await this.askAmazonQ(argument);
              console.log(response);
            }
            break;

          case 'translate':
            if (!argument) {
              console.log('Usage: translate <task description>');
            } else {
              console.log('🔄 Translating to shell command...\n');
              const response = await this.translateToShell(argument);
              console.log(response);
            }
            break;

          case 'audit':
            if (!argument) {
              console.log('Usage: audit <code>');
            } else {
              console.log('🔍 Auditing code...\n');
              const response = await this.auditCode(argument);
              console.log(response);
            }
            break;

          case 'fix':
            const parts = argument.split(' ');
            if (parts.length < 2) {
              console.log('Usage: fix <code> <issue description>');
            } else {
              const code = parts[0];
              const issue = parts.slice(1).join(' ');
              console.log('🔧 Getting fix suggestions...\n');
              const response = await this.fixCode(code, issue);
              console.log(response);
            }
            break;

          case 'help':
            console.log(this.showHelp());
            break;

          case 'quit':
          case 'exit':
            console.log('Goodbye! 👋');
            this.mcpServer.kill();
            process.exit(0);
            break;

          default:
            console.log(`Unknown command: ${command}`);
            console.log('Type "help" for available commands');
        }
      } catch (error) {
        console.error('Error:', error.message);
      }

      console.log();
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\nGoodbye! 👋');
      this.mcpServer.kill();
      process.exit(0);
    });
  }
}

// Start the bridge
const bridge = new CursorAgentAmazonQBridge();
bridge.start().catch(console.error);
