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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Enhanced Error Classification System
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SERVICE_CAPACITY_ERROR = 'SERVICE_CAPACITY_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  Q_CLI_NOT_FOUND = 'Q_CLI_NOT_FOUND',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface ErrorGuidance {
  message: string;
  actions: string[];
  retryable: boolean;
}

class MCPError extends Error {
  constructor(
    public type: ErrorType,
    public code: string,
    message: string,
    public retryable: boolean = false,
    public guidance?: ErrorGuidance
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

class AmazonQMCPServer {
  private server: Server;
  private startTime: Date;
  private errorGuidanceMap!: Map<ErrorType, ErrorGuidance>;

  constructor() {
    this.startTime = new Date();
    this.initializeErrorGuidance();
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;
      const { sessionId, requestId } = extra || {};

      console.error(`[${requestId || 'unknown'}] Tool: ${name}, Session: ${sessionId || 'none'}`);

      try {
        switch (name) {
          case 'ask_q':
          case 'take_q':
            return await this.handleAskQ(args, sessionId);
          case 'q_translate':
            return await this.handleQTranslate(args, sessionId);
          case 'fetch_chunk':
            return await this.handleFetchChunk(args);
          case 'q_status':
            return await this.handleQStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`[${requestId || 'unknown'}] Error in ${name}:`, error);
        
        // If it's already a classified MCPError, format it properly
        if (error instanceof MCPError) {
          return this.formatErrorResponse(error, String(requestId));
        }
        
        // Otherwise, classify and format the error
        const classifiedError = this.classifyError(error, name);
        return this.formatErrorResponse(classifiedError, String(requestId));
      }
    });
  }

  private getSessionDirectory(sessionId?: string): string {
    const effectiveSessionId = sessionId || 'default';
    const sessionDir = path.join(os.homedir(), '.amazon-q-mcp', 'sessions', effectiveSessionId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      console.error(`[INFO] Created session directory: ${sessionDir}`);
    }
    
    return sessionDir;
  }

  private initializeErrorGuidance(): void {
    this.errorGuidanceMap = new Map<ErrorType, ErrorGuidance>([
      [ErrorType.AUTHENTICATION_ERROR, {
        message: "Authentication failed with Amazon Q CLI",
        actions: [
          "Run 'q status' to check authentication status",
          "Try 'q login' to re-authenticate",
          "Verify AWS credentials are properly configured",
          "Check if you have the necessary Amazon Q permissions"
        ],
        retryable: false
      }],
      [ErrorType.SERVICE_CAPACITY_ERROR, {
        message: "Amazon Q service is experiencing high demand",
        actions: [
          "Wait a few moments and try again",
          "The service will automatically retry with exponential backoff",
          "Consider trying during off-peak hours"
        ],
        retryable: true
      }],
      [ErrorType.NETWORK_ERROR, {
        message: "Network connection issue",
        actions: [
          "Check your internet connection",
          "Verify proxy settings if applicable",
          "Check SSL certificate configuration",
          "Try connecting from a different network"
        ],
        retryable: true
      }],
      [ErrorType.Q_CLI_NOT_FOUND, {
        message: "Amazon Q CLI not found or not accessible",
        actions: [
          "Install Amazon Q CLI from AWS documentation",
          "Ensure 'q' command is in your PATH",
          "Run 'which q' to verify installation",
          "Check file permissions on Q CLI executable"
        ],
        retryable: false
      }],
      [ErrorType.CONFIGURATION_ERROR, {
        message: "Configuration issue detected",
        actions: [
          "Run 'q doctor' to diagnose configuration issues",
          "Check ~/.aws/config and ~/.aws/credentials files",
          "Verify AWS region is properly set",
          "Validate JSON syntax in configuration files"
        ],
        retryable: false
      }],
      [ErrorType.VALIDATION_ERROR, {
        message: "Invalid parameters provided",
        actions: [
          "Check the parameters passed to the tool",
          "Refer to tool documentation for valid parameter formats",
          "Ensure required parameters are provided"
        ],
        retryable: false
      }]
    ]);
  }

  private classifyError(error: any, context: string): MCPError {
    const errorMessage = error?.message || String(error);
    const stderr = error?.stderr || '';
    
    // Authentication errors
    if (errorMessage.includes('AccessDeniedException') || 
        errorMessage.includes('UnauthorizedOperation') ||
        errorMessage.includes('authentication') ||
        stderr.includes('login required')) {
      return new MCPError(
        ErrorType.AUTHENTICATION_ERROR,
        'AUTH_FAILED',
        errorMessage,
        false,
        this.errorGuidanceMap.get(ErrorType.AUTHENTICATION_ERROR)
      );
    }
    
    // Service capacity errors
    if (errorMessage.includes('trouble responding right now') ||
        errorMessage.includes('capacity') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('throttle')) {
      return new MCPError(
        ErrorType.SERVICE_CAPACITY_ERROR,
        'SERVICE_OVERLOAD',
        errorMessage,
        true,
        this.errorGuidanceMap.get(ErrorType.SERVICE_CAPACITY_ERROR)
      );
    }
    
    // Network errors
    if (errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('SSL') ||
        errorMessage.includes('certificate')) {
      return new MCPError(
        ErrorType.NETWORK_ERROR,
        'NETWORK_FAILED',
        errorMessage,
        true,
        this.errorGuidanceMap.get(ErrorType.NETWORK_ERROR)
      );
    }
    
    // Q CLI not found
    if (errorMessage.includes('Failed to execute Q CLI') ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('command not found')) {
      return new MCPError(
        ErrorType.Q_CLI_NOT_FOUND,
        'Q_CLI_MISSING',
        errorMessage,
        false,
        this.errorGuidanceMap.get(ErrorType.Q_CLI_NOT_FOUND)
      );
    }
    
    // Configuration errors
    if (errorMessage.includes('configuration') ||
        errorMessage.includes('config') ||
        stderr.includes('doctor')) {
      return new MCPError(
        ErrorType.CONFIGURATION_ERROR,
        'CONFIG_ERROR',
        errorMessage,
        false,
        this.errorGuidanceMap.get(ErrorType.CONFIGURATION_ERROR)
      );
    }
    
    // Default to unknown error
    return new MCPError(
      ErrorType.UNKNOWN_ERROR,
      'UNKNOWN',
      errorMessage,
      false,
      {
        message: "An unexpected error occurred",
        actions: [
          "Check the error details for more information",
          "Try running the command again",
          "Contact support if the issue persists"
        ],
        retryable: false
      }
    );
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const classifiedError = this.classifyError(error, context);
        
        console.error(`[${context}] Attempt ${attempt} failed:`, classifiedError.type, classifiedError.message);
        
        // Don't retry if error is not retryable or we've reached max attempts
        if (!classifiedError.retryable || attempt === maxRetries) {
          throw classifiedError;
        }
        
        // Calculate delay with exponential backoff
        const baseDelay = 500; // 500ms
        const maxDelay = 10000; // 10 seconds
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        const jitter = Math.random() * 0.25 * delay; // 25% jitter
        const finalDelay = delay + jitter;
        
        console.error(`[${context}] Retrying in ${Math.round(finalDelay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
    
    throw lastError;
  }

  private formatErrorResponse(error: MCPError, requestId?: string): any {
    const errorInfo = {
      type: error.type,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      guidance: error.guidance,
      timestamp: new Date().toISOString(),
      requestId: requestId || 'unknown'
    };

    return {
      content: [
        {
          type: 'text',
          text: `❌ **${error.guidance?.message || 'Error'}**\n\n` +
                `**Error Type:** ${error.type}\n` +
                `**Code:** ${error.code}\n` +
                `**Retryable:** ${error.retryable ? 'Yes' : 'No'}\n\n` +
                `**Recommended Actions:**\n` +
                (error.guidance?.actions.map(action => `• ${action}`).join('\n') || '• Contact support') +
                `\n\n**Technical Details:**\n\`\`\`\n${error.message}\n\`\`\``,
        },
      ],
    };
  }

  private async handleAskQ(args: any, sessionId?: string) {
    try {
      const schema = z.object({
        prompt: z.string(),
        model: z.string().optional(),
        agent: z.string().optional(),
      });

      const { prompt, model, agent } = schema.parse(args);

      const qArgs = ['chat', '--resume', '--no-interactive'];
      
      if (model) {
        qArgs.push('--model', model);
      }
      
      if (agent) {
        qArgs.push('--agent', agent);
      }

      // Get session directory for this session
      const sessionDir = this.getSessionDirectory(sessionId);

      // Execute with retry and error recovery
      const result = await this.executeWithRetry(
        () => this.executeQCommandWithInputInDirectory(qArgs, prompt, sessionDir),
        'ask_q'
      );

      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        const validationError = new MCPError(
          ErrorType.VALIDATION_ERROR,
          'INVALID_PARAMS',
          `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`,
          false,
          this.errorGuidanceMap.get(ErrorType.VALIDATION_ERROR)
        );
        throw validationError;
      }

      // Re-throw MCPError as-is, or classify unknown errors
      if (error instanceof MCPError) {
        throw error;
      }

      throw this.classifyError(error, 'ask_q');
    }
  }

  private async handleQTranslate(args: any, sessionId?: string) {
    try {
      const schema = z.object({
        task: z.string(),
      });

      const { task } = schema.parse(args);

      // Get session directory for consistent context
      const sessionDir = this.getSessionDirectory(sessionId);
      
      // Execute with retry and error recovery
      const result = await this.executeWithRetry(
        () => this.executeQCommandWithInputInDirectory(['translate'], task, sessionDir),
        'q_translate'
      );

      return {
        content: [
          {
            type: 'text',
            text: `\`\`\`bash\n${result.stdout.trim()}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        const validationError = new MCPError(
          ErrorType.VALIDATION_ERROR,
          'INVALID_PARAMS',
          `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`,
          false,
          this.errorGuidanceMap.get(ErrorType.VALIDATION_ERROR)
        );
        throw validationError;
      }

      // Re-throw MCPError as-is, or classify unknown errors
      if (error instanceof MCPError) {
        throw error;
      }

      throw this.classifyError(error, 'q_translate');
    }
  }

  private async handleQStatus(args: any) {
    try {
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

      // Run diagnostics
      const diagnostics = await this.runDiagnostics();

      const status = {
        server: "Amazon Q CLI MCP Server",
        version: "1.0.0", 
        status: diagnostics.overall ? "healthy" : "unhealthy",
        uptime: formatUptime(),
        startTime: this.startTime.toISOString(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        availableTools: ["ask_q", "take_q", "q_translate", "fetch_chunk", "q_status"],
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, 
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
        diagnostics: diagnostics,
        sessionManagement: {
          enabled: true,
          sessionDirectory: path.join(os.homedir(), '.amazon-q-mcp', 'sessions'),
          activeSessions: this.getActiveSessionCount()
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `# Amazon Q CLI MCP Server Status\n\n` +
                  `**Overall Status:** ${status.status.toUpperCase()} ${status.status === 'healthy' ? '✅' : '❌'}\n` +
                  `**Uptime:** ${status.uptime}\n` +
                  `**Node Version:** ${status.nodeVersion}\n` +
                  `**Platform:** ${status.platform}\n` +
                  `**Memory Usage:** ${status.memoryUsage.rss}\n\n` +
                  `## Diagnostics\n\n` +
                  `- **Amazon Q CLI:** ${diagnostics.qCliAvailable ? '✅ Available' : '❌ Not Found'}\n` +
                  `- **Authentication:** ${diagnostics.authStatus ? '✅ Valid' : '❌ Invalid'}\n` +
                  `- **Configuration:** ${diagnostics.configValid ? '✅ Valid' : '❌ Invalid'}\n` +
                  `- **Session Management:** ${diagnostics.sessionDirWritable ? '✅ Working' : '❌ Error'}\n\n` +
                  `## Session Information\n\n` +
                  `- **Session Directory:** \`${status.sessionManagement.sessionDirectory}\`\n` +
                  `- **Active Sessions:** ${status.sessionManagement.activeSessions}\n\n` +
                  `## Available Tools\n\n` +
                  status.availableTools.map(tool => `- **${tool}**`).join('\n') +
                  `\n\n---\n\n` +
                  `<details><summary>Raw Status JSON</summary>\n\n\`\`\`json\n${JSON.stringify(status, null, 2)}\n\`\`\`\n\n</details>`,
          },
        ],
      };
    } catch (error) {
      throw this.classifyError(error, 'q_status');
    }
  }

  private async runDiagnostics() {
    const diagnostics = {
      overall: true,
      qCliAvailable: false,
      authStatus: false,
      configValid: false,
      sessionDirWritable: false,
      issues: [] as string[]
    };

    try {
      // Check if Q CLI is available
      await new Promise<void>((resolve, reject) => {
        const child = spawn('q', ['--version'], { stdio: 'pipe' });
        child.on('close', (code) => {
          if (code === 0) {
            diagnostics.qCliAvailable = true;
            resolve();
          } else {
            diagnostics.issues.push('Amazon Q CLI not found or not executable');
            reject(new Error('Q CLI not available'));
          }
        });
        child.on('error', () => {
          diagnostics.issues.push('Amazon Q CLI not found in PATH');
          reject(new Error('Q CLI not found'));
        });
      });
    } catch (error) {
      diagnostics.overall = false;
    }

    try {
      // Check session directory
      const sessionDir = path.join(os.homedir(), '.amazon-q-mcp', 'sessions');
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      // Test write access
      const testFile = path.join(sessionDir, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      diagnostics.sessionDirWritable = true;
    } catch (error) {
      diagnostics.issues.push('Cannot write to session directory');
      diagnostics.overall = false;
    }

    try {
      // Check basic config/auth by trying a simple command
      await new Promise<void>((resolve, reject) => {
        const child = spawn('q', ['status'], { stdio: 'pipe' });
        child.on('close', (code) => {
          if (code === 0) {
            diagnostics.authStatus = true;
            diagnostics.configValid = true;
            resolve();
          } else {
            diagnostics.issues.push('Authentication or configuration issue');
            reject(new Error('Auth/config issue'));
          }
        });
        child.on('error', reject);
      });
    } catch (error) {
      // This is not critical for overall health
      diagnostics.issues.push('Cannot verify authentication status');
    }

    return diagnostics;
  }

  private getActiveSessionCount(): number {
    try {
      const sessionDir = path.join(os.homedir(), '.amazon-q-mcp', 'sessions');
      if (!fs.existsSync(sessionDir)) {
        return 0;
      }
      return fs.readdirSync(sessionDir).filter(dir => 
        fs.statSync(path.join(sessionDir, dir)).isDirectory()
      ).length;
    } catch (error) {
      return 0;
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

  private async executeQCommandWithInputInDirectory(args: string[], input: string, workingDir: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('q', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir, // Execute in session-specific directory
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
          reject(new Error(`Q CLI exited with code ${code}: ${stderr}`));
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
