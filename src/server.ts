#!/usr/bin/env node

/**
 * Amazon Q CLI MCP Server
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
  }

  private async initialize(): Promise<void> {
    console.error('[Amazon Q MCP] init Amazon Q CLI MCP Server');
    
    this.setupToolHandlers();
    this.setupErrorHandling();
    
    // Add any other async initialization here if needed in the future
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
            name: 'take_q',
            description: 'Execute Amazon Q CLI with a prompt to get AI assistance (alias for ask_q)',
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
              name: 'fetch_chunk',
              description: 'Fetch a byte range from a URL (chunked HTTP fetch)',
              inputSchema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'HTTP/HTTPS URL to fetch',
                  },
                  start: {
                    type: 'number',
                    description: 'Start byte offset (default 0)',
                  },
                  length: {
                    type: 'number',
                    description: 'Number of bytes to fetch (default 65536)',
                  },
                  headers: {
                    type: 'object',
                    description: 'Optional request headers',
                  },
                },
                required: ['url'],
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
          case 'take_q':
            return await this.handleAskQ(args);
          case 'q_translate':
            return await this.handleQTranslate(args);
          case 'fetch_chunk':
            return await this.handleFetchChunk(args);
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

  private async handleFetchChunk(args: any) {
    const schema = z.object({
      url: z.string().url(),
      start: z.number().int().min(0).optional().default(0),
      length: z.number().int().min(1).max(10 * 1024 * 1024).optional().default(65536), // cap at 10MB
      headers: z.record(z.string()).optional().default({}),
    });

    const { url, start, length, headers } = schema.parse(args);

    const endInclusive = start + length - 1;

    const requestHeaders: Record<string, string> = {
      ...headers,
      Range: `bytes=${start}-${endInclusive}`,
    };

    const response = await fetch(url, { headers: requestHeaders, method: 'GET' });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const contentRange = response.headers.get('content-range');
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // If server ignored Range (status 200 without Content-Range), slice client-side
    if (status === 200 && !contentRange) {
      const sliceStart = Math.min(start, buffer.length);
      const sliceEnd = Math.min(buffer.length, endInclusive + 1);
      buffer = buffer.subarray(sliceStart, sliceEnd);
    }
    const dataBase64 = buffer.toString('base64');

    // Try to parse total size from Content-Range: bytes start-end/total
    let totalBytes: number | null = null;
    if (contentRange) {
      const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
      if (match) {
        const totalPart = match[3];
        totalBytes = totalPart === '*' ? null : Number(totalPart);
      }
    }

    const resultPayload = {
      url,
      ok: response.ok,
      status,
      contentType,
      requested: { start, end: endInclusive },
      receivedBytes: buffer.byteLength,
      contentRange: contentRange || null,
      totalBytes,
      encoding: 'base64',
      dataBase64,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resultPayload, null, 2),
        },
      ],
    };
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
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio');
  }
}

// Start the server
const server = new AmazonQMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { AmazonQMCPServer };
