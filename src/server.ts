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
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import { AmazonQSessionLogger } from './session-logger.js';

class AmazonQMCPServer {
  private server: Server;
  private startTime: Date;
  private sessionLogger: AmazonQSessionLogger;

  constructor() {
    this.startTime = new Date();
    
    // Initialize session logger first
    this.sessionLogger = new AmazonQSessionLogger(process.cwd());
    this.sessionLogger.logActivity('SERVER_INIT', 'Initializing Amazon Q MCP Server');
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
    
    this.sessionLogger.logActivity('SERVER_READY', 'Amazon Q MCP Server initialized successfully');
    this.sessionLogger.updateStatus('ready');
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.sessionLogger.logActivity('MCP_ERROR', 'MCP server error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      this.sessionLogger.logActivity('SHUTDOWN', 'Received SIGINT signal');
      this.sessionLogger.updateStatus('shutdown');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.sessionLogger.logActivity('SHUTDOWN', 'Received SIGTERM signal');
      this.sessionLogger.updateStatus('shutdown');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'amazon-q-cli-mcp-server',
          version: '1.0.0',
        },
      };
    });

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
            name: 'cue_q',
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

      this.sessionLogger.logActivity('TOOL_CALL', `Tool '${name}' called`, {
        toolName: name,
        argsPreview: this.getArgsPreview(args)
      });

      try {
        let result;
        switch (name) {
          case 'ask_q':
          case 'cue_q':
            result = await this.handleAskQ(args);
            break;
          case 'q_translate':
            result = await this.handleQTranslate(args);
            break;
          case 'fetch_chunk':
            result = await this.handleFetchChunk(args);
            break;
          case 'q_status':
            result = await this.handleQStatus(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        this.sessionLogger.logActivity('TOOL_SUCCESS', `Tool '${name}' completed successfully`);
        return result;
      } catch (error) {
        this.sessionLogger.logActivity('TOOL_ERROR', `Tool '${name}' failed`, {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
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

  private getArgsPreview(args: any): any {
    // Create a safe preview of arguments for logging (truncate long values)
    if (!args || typeof args !== 'object') {
      return args;
    }

    const preview: any = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.length > 100) {
        preview[key] = value.substring(0, 100) + '... (truncated)';
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
        preview[key] = '[REDACTED]';
      } else {
        preview[key] = value;
      }
    }
    return preview;
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
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    const formatUptime = () => {
      if (uptimeHours > 0) {
        return `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
      } else if (uptimeMinutes > 0) {
        return `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
      } else {
        return `${uptimeSeconds}s`;
      }
    };

    const activeSessions = AmazonQSessionLogger.getActiveSessions();
    const sessionInfo = this.sessionLogger.getSessionInfo();

    const status = {
      server: "Amazon Q CLI MCP Server",
      version: "1.0.0",
      status: "healthy",
      uptime: formatUptime(),
      startTime: this.startTime.toISOString(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      availableTools: ["ask_q", "cue_q", "q_translate", "fetch_chunk", "q_status"],
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
      session: {
        sessionId: sessionInfo.sessionId,
        claudeInstance: sessionInfo.claudeInstance,
        status: sessionInfo.status,
        projectPath: sessionInfo.projectPath,
        totalActiveSessions: Object.keys(activeSessions).length,
        activeSessions: Object.values(activeSessions).map(s => ({
          sessionId: s.sessionId,
          claudeInstance: s.claudeInstance,
          pid: s.pid,
          status: s.status,
          uptime: Math.round((Date.now() - s.startTime) / 1000)
        }))
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
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
    this.sessionLogger.logActivity('TRANSPORT_INIT', 'Initializing stdio transport');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.sessionLogger.logActivity('SERVER_CONNECTED', 'Server connected and running on stdio', {
      sessionId: this.sessionLogger.getSessionId(),
      claudeInstance: this.sessionLogger.getClaudeInstance()
    });
    
    // Clean up stale sessions from previous runs
    const cleanedCount = AmazonQSessionLogger.cleanupStaleSessionsFromRegistry();
    if (cleanedCount > 0) {
      this.sessionLogger.logActivity('CLEANUP', `Cleaned up ${cleanedCount} stale sessions`);
    }
    
    console.error('[INFO] Amazon Q CLI MCP Server running on stdio (this STDERR message is by design)');
  }
}

// Start the server
const server = new AmazonQMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  // Try to log the error if session logger exists
  try {
    if ((server as any).sessionLogger) {
      (server as any).sessionLogger.logActivity('STARTUP_ERROR', 'Failed to start server', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      (server as any).sessionLogger.updateStatus('error');
    }
  } catch {
    // Silent failure during error logging
  }
  process.exit(1);
});

export { AmazonQMCPServer };
