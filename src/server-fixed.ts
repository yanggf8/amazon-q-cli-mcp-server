#!/usr/bin/env node

/**
 * Amazon Q CLI MCP Server - Fixed Version
 * 
 * Simple, focused tools that directly leverage Amazon Q CLI capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { spawn } from 'child_process';

class AmazonQMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'amazon-q-cli-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ask_q',
            description: 'Execute Amazon Q CLI with a prompt to get AI assistance',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The question or prompt to send to Amazon Q',
                },
                model: {
                  type: 'string',
                  description: 'Model to use (optional)',
                },
                agent: {
                  type: 'string',
                  description: 'Agent/context profile to use (optional)',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'q_translate',
            description: 'Convert natural language to shell commands using Amazon Q',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'Natural language description of the task (e.g., "find all Python files")',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'q_status',
            description: 'Check Amazon Q CLI status and configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'ask_q':
            return await this.handleAskQ(args);
          case 'q_translate':
            return await this.handleQTranslate(args);
          case 'q_status':
            return await this.handleQStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async handleAskQ(args: any) {
    const schema = z.object({
      prompt: z.string(),
      model: z.string().optional(),
      agent: z.string().optional(),
    });

    const { prompt, model, agent } = schema.parse(args);

    try {
      const qArgs = ['chat', '--no-interactive'];
      
      if (model) {
        qArgs.push('--model', model);
      }
      
      if (agent) {
        qArgs.push('--agent', agent);
      }

      // Use stdin to pass the prompt instead of command line argument
      const result = await this.executeQCommandWithInput(qArgs, prompt);
      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Amazon Q CLI failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleQTranslate(args: any) {
    const schema = z.object({
      task: z.string(),
    });

    const { task } = schema.parse(args);

    try {
      const result = await this.executeQCommandWithInput(['translate'], task);
      return {
        content: [
          {
            type: 'text',
            text: `\`\`\`bash\n${result.stdout.trim()}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleQStatus(args: any) {
    try {
      const result = await this.executeQCommand(['doctor']);
      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeQCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('q', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute Q CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Q CLI exited with code ${code}`));
        }
      });

      child.stdin.end();
    });
  }

  private async executeQCommandWithInput(args: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('q', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute Q CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Q CLI exited with code ${code}`));
        }
      });

      // Write input to stdin and close it
      child.stdin.write(input + '\n');
      child.stdin.end();
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Amazon Q CLI MCP Server running on stdio');
  }
}

// Start the server
const server = new AmazonQMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { AmazonQMCPServer };
