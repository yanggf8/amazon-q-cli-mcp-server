#!/usr/bin/env node

/**
 * Amazon Q CLI MCP Server
 *
 * Simple, focused tools that directly leverage Amazon Q CLI capabilities
 * with session-based logging and enhanced error recovery
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AmazonQSessionLogger } from './session-logger.js';
import {
  CONFIG,
  ALLOWED_Q_COMMANDS,
  ALLOWED_HTTP_HEADERS,
  ALLOWED_URL_SCHEMES,
  SERVER_INFO,
  TOOL_NAMES,
  LOG_TYPES
} from './constants.js';

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

/**
 * Custom error class for MCP operations with enhanced error classification
 */
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

/**
 * Main MCP Server class for Amazon Q CLI integration
 */
class AmazonQMCPServer {
  private server: Server;
  private startTime: Date;
  private sessionLogger: AmazonQSessionLogger;
  private errorGuidanceMap!: Map<ErrorType, ErrorGuidance>;
  private activeProcesses: Set<ChildProcess> = new Set();
  private diagnosticsCache?: { result: any; timestamp: number };

  constructor() {
    this.startTime = new Date();

    // Initialize session logger first
    this.sessionLogger = new AmazonQSessionLogger(process.cwd());
    this.sessionLogger.logActivity(LOG_TYPES.SERVER_INIT, 'Initializing Amazon Q MCP Server');

    // Initialize error handling system
    this.initializeErrorGuidance();

    this.server = new Server(
      {
        name: SERVER_INFO.NAME,
        version: SERVER_INFO.VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  /**
   * Initialize the MCP server and setup handlers
   */
  private async initialize(): Promise<void> {
    console.error('[Amazon Q MCP] init Amazon Q CLI MCP Server');

    this.setupToolHandlers();
    this.setupErrorHandling();

    this.sessionLogger.logActivity(LOG_TYPES.SERVER_READY, 'Amazon Q MCP Server initialized successfully');
    this.sessionLogger.updateStatus('ready');
  }

  /**
   * Setup error handling and cleanup handlers for process signals
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.sessionLogger.logActivity(LOG_TYPES.MCP_ERROR, 'MCP server error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.error('[MCP Error]', error);
    };

    const cleanupAndExit = async (signal: string) => {
      this.sessionLogger.logActivity(LOG_TYPES.SHUTDOWN, `Received ${signal} signal`);
      this.sessionLogger.updateStatus('shutdown');

      console.error(`[Amazon Q MCP] Shutting down. Cleaning up ${this.activeProcesses.size} active processes...`);
      for (const child of this.activeProcesses) {
        try {
          this.killProcessCrossPlatform(child);
          this.sessionLogger.logActivity(LOG_TYPES.CLEANUP, `Terminated process ${child.pid}`);
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          this.sessionLogger.logActivity(LOG_TYPES.CLEANUP_ERROR, `Failed to terminate process ${child.pid}`, { error: errorMsg });
          console.error('[CLEANUP ERROR]', errorMsg);
        }
      }
      this.activeProcesses.clear();

      await this.server.close();
      process.exit(0);
    };

    process.on('SIGINT', () => cleanupAndExit('SIGINT'));
    process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
  }

  /**
   * Kill a child process in a cross-platform compatible way
   * @param child - The child process to terminate
   */
  private killProcessCrossPlatform(child: ChildProcess): void {
    if (!child.pid) {
      return;
    }

    try {
      if (process.platform === 'win32') {
        // Windows: use taskkill to kill process tree
        spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F']);
      } else {
        // Unix-like: kill the entire process group
        try {
          process.kill(-child.pid);
        } catch (e) {
          // If process group kill fails, try regular kill
          child.kill('SIGTERM');
        }
      }
    } catch (e) {
      // Fallback: try to kill just the process
      try {
        child.kill('SIGTERM');
      } catch (fallbackError) {
        // Process might already be dead
        console.error(`[WARN] Could not kill process ${child.pid}`);
      }
    }
  }

  /**
   * Setup MCP protocol tool handlers
   */
  private setupToolHandlers(): void {
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      return {
        protocolVersion: SERVER_INFO.PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: SERVER_INFO.NAME,
          version: SERVER_INFO.VERSION,
        },
      };
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: TOOL_NAMES.ASK_Q,
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
            name: TOOL_NAMES.TAKE_Q,
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
            name: TOOL_NAMES.Q_TRANSLATE,
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
            name: TOOL_NAMES.FETCH_CHUNK,
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
                  description: `Number of bytes to fetch (default ${CONFIG.DEFAULT_FETCH_SIZE_BYTES})`,
                },
                headers: {
                  type: 'object',
                  description: 'Optional request headers (only safe headers allowed)',
                },
              },
              required: ['url'],
            },
          },
          {
            name: TOOL_NAMES.Q_STATUS,
            description: 'Check Amazon Q CLI installation and configuration status',
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

      this.sessionLogger.logActivity(LOG_TYPES.TOOL_CALL, `Tool '${name}' called`, {
        toolName: name,
        argsPreview: this.getArgsPreview(args),
        sessionId: sessionId || 'none',
        requestId: requestId || 'unknown'
      });

      try {
        let result;
        switch (name) {
          case TOOL_NAMES.ASK_Q:
          case TOOL_NAMES.TAKE_Q:
            result = await this.handleAskQ(args, sessionId);
            break;
          case TOOL_NAMES.Q_TRANSLATE:
            result = await this.handleQTranslate(args, sessionId);
            break;
          case TOOL_NAMES.FETCH_CHUNK:
            result = await this.handleFetchChunk(args);
            break;
          case TOOL_NAMES.Q_STATUS:
            result = await this.handleQStatus(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        this.sessionLogger.logActivity(LOG_TYPES.TOOL_SUCCESS, `Tool '${name}' completed successfully`);
        return result;
      } catch (error) {
        console.error(`[${requestId || 'unknown'}] Error in ${name}:`, error);

        this.sessionLogger.logActivity(LOG_TYPES.TOOL_ERROR, `Tool '${name}' failed`, {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          sessionId: sessionId || 'none',
          requestId: requestId || 'unknown'
        });

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

  /**
   * Get session directory for a given session ID
   * @param sessionId - Optional session identifier
   * @returns Path to session directory
   */
  private getSessionDirectory(sessionId?: string): string {
    const effectiveSessionId = sessionId || 'default';

    // Sanitize session ID to prevent path traversal
    const sanitizedSessionId = this.sanitizeSessionId(effectiveSessionId);

    const sessionDir = path.join(os.homedir(), '.amazon-q-mcp', 'sessions', sanitizedSessionId);

    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      console.error(`[INFO] Created session directory: ${sessionDir}`);
    }

    return sessionDir;
  }

  /**
   * Sanitize session ID to prevent path traversal attacks
   * @param sessionId - Raw session ID
   * @returns Sanitized session ID
   */
  private sanitizeSessionId(sessionId: string): string {
    // Remove any characters that could be used for path traversal
    return sessionId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, CONFIG.SESSION_ID_MAX_LENGTH);
  }

  /**
   * Validate Q CLI command arguments against whitelist
   * @param args - Command arguments to validate
   * @throws {MCPError} If command is not in whitelist
   */
  private validateCommandArgs(args: string[]): void {
    if (args.length === 0) return;

    // Validate against allowed commands
    if (!ALLOWED_Q_COMMANDS.includes(args[0] as any)) {
      throw new MCPError(
        ErrorType.VALIDATION_ERROR,
        'INVALID_COMMAND',
        `Command not allowed: ${args[0]}`,
        false,
        this.errorGuidanceMap.get(ErrorType.VALIDATION_ERROR)
      );
    }
  }

  /**
   * Create a safe preview of arguments for logging (redact sensitive data)
   * @param args - Arguments to preview
   * @returns Sanitized preview object
   */
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

  /**
   * Initialize error guidance map with user-friendly error messages
   */
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

  /**
   * Classify an error into appropriate error type with guidance
   * @param error - Error to classify
   * @param context - Context where error occurred
   * @returns Classified MCPError
   */
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

  /**
   * Execute an operation with exponential backoff retry logic
   * @param operation - Async operation to execute
   * @param context - Context for logging
   * @param maxRetries - Maximum number of retry attempts
   * @returns Result of the operation
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = CONFIG.MAX_RETRIES
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const classifiedError = this.classifyError(error, context);

        console.error(`[${context}] Attempt ${attempt} failed:`, classifiedError.type, classifiedError.message);

        // Log the retry attempt
        this.sessionLogger.logActivity(LOG_TYPES.RETRY_ATTEMPT, `${context} retry attempt ${attempt}/${maxRetries}`, {
          errorType: classifiedError.type,
          errorMessage: classifiedError.message,
          retryable: classifiedError.retryable
        });

        // Don't retry if error is not retryable or we've reached max attempts
        if (!classifiedError.retryable || attempt === maxRetries) {
          throw classifiedError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
          CONFIG.RETRY_MAX_DELAY_MS
        );
        const jitter = Math.random() * CONFIG.RETRY_JITTER_FACTOR * delay;
        const finalDelay = delay + jitter;

        console.error(`[${context}] Retrying in ${Math.round(finalDelay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }

    throw lastError;
  }

  /**
   * Format an MCPError into a user-friendly response
   * @param error - MCPError to format
   * @param requestId - Request ID for tracking
   * @returns Formatted error response
   */
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

  /**
   * Handle ask_q/take_q tool invocation
   * @param args - Tool arguments
   * @param sessionId - Optional session ID
   * @returns Tool response
   */
  private async handleAskQ(args: any, sessionId?: string) {
    try {
      const schema = z.object({
        prompt: z.string().min(1).max(CONFIG.MAX_PROMPT_LENGTH),
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
        () => this.executeQCommandInDirectory(qArgs, sessionDir, prompt),
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

  /**
   * Handle q_translate tool invocation
   * @param args - Tool arguments
   * @param sessionId - Optional session ID
   * @returns Tool response
   */
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
        () => this.executeQCommandInDirectory(['translate'], sessionDir, task),
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

  /**
   * Handle q_status tool invocation with caching
   * @param args - Tool arguments
   * @returns Tool response with status information
   */
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

      // Run diagnostics (with caching)
      const diagnostics = await this.runDiagnostics();

      // Get session info
      const activeSessions = AmazonQSessionLogger.getActiveSessions();
      const sessionInfo = this.sessionLogger.getSessionInfo();

      const status = {
        server: "Amazon Q CLI MCP Server",
        version: SERVER_INFO.VERSION,
        status: diagnostics.overall ? "healthy" : "unhealthy",
        uptime: formatUptime(),
        startTime: this.startTime.toISOString(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        availableTools: [TOOL_NAMES.ASK_Q, TOOL_NAMES.TAKE_Q, TOOL_NAMES.Q_TRANSLATE, TOOL_NAMES.FETCH_CHUNK, TOOL_NAMES.Q_STATUS],
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
            text: `# Amazon Q CLI MCP Server Status\n\n` +
                  `**Overall Status:** ${status.status.toUpperCase()} ${status.status === 'healthy' ? '✅' : '❌'}\n` +
                  `**Uptime:** ${status.uptime}\n` +
                  `**Node Version:** ${status.nodeVersion}\n` +
                  `**Platform:** ${status.platform}\n` +
                  `**Memory Usage:** ${status.memoryUsage.rss}\n\n` +
                  `## Session Information\n\n` +
                  `- **Session ID:** ${status.session.sessionId}\n` +
                  `- **Claude Instance:** ${status.session.claudeInstance}\n` +
                  `- **Status:** ${status.session.status}\n` +
                  `- **Total Active Sessions:** ${status.session.totalActiveSessions}\n\n` +
                  `## Diagnostics\n\n` +
                  `- **Amazon Q CLI:** ${diagnostics.qCliAvailable ? '✅ Available' : '❌ Not Found'}\n` +
                  `- **Authentication:** ${diagnostics.authStatus ? '✅ Valid' : '❌ Invalid'}\n` +
                  `- **Configuration:** ${diagnostics.configValid ? '✅ Valid' : '❌ Invalid'}\n` +
                  `- **Session Management:** ${diagnostics.sessionDirWritable ? '✅ Working' : '❌ Error'}\n\n` +
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

  /**
   * Run diagnostic checks with caching to improve performance
   * @returns Diagnostic results
   */
  private async runDiagnostics() {
    // Return cached result if still valid
    if (this.diagnosticsCache &&
        Date.now() - this.diagnosticsCache.timestamp < CONFIG.DIAGNOSTICS_CACHE_TTL_MS) {
      return this.diagnosticsCache.result;
    }

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
        const child = spawn('q', ['--version'], { stdio: 'pipe', detached: true });
        this.activeProcesses.add(child);
        const cleanup = () => this.activeProcesses.delete(child);
        child.on('close', (code) => {
          cleanup();
          if (code === 0) {
            diagnostics.qCliAvailable = true;
            resolve();
          } else {
            diagnostics.issues.push('Amazon Q CLI not found or not executable');
            reject(new Error('Q CLI not available'));
          }
        });
        child.on('error', (err) => {
          cleanup();
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
        const child = spawn('q', ['status'], { stdio: 'pipe', detached: true });
        this.activeProcesses.add(child);
        const cleanup = () => this.activeProcesses.delete(child);
        child.on('close', (code) => {
          cleanup();
          if (code === 0) {
            diagnostics.authStatus = true;
            diagnostics.configValid = true;
            resolve();
          } else {
            diagnostics.issues.push('Authentication or configuration issue');
            reject(new Error('Auth/config issue'));
          }
        });
        child.on('error', (err) => {
          cleanup();
          reject(err);
        });
      });
    } catch (error) {
      // This is not critical for overall health
      diagnostics.issues.push('Cannot verify authentication status');
    }

    // Cache the result
    this.diagnosticsCache = {
      result: diagnostics,
      timestamp: Date.now()
    };

    return diagnostics;
  }

  /**
   * Get count of active session directories
   * @returns Number of active sessions
   */
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

  /**
   * Handle fetch_chunk tool invocation with security validations
   * @param args - Tool arguments
   * @returns Tool response with fetched data
   */
  private async handleFetchChunk(args: any) {
    const schema = z.object({
      url: z.string().url().refine(
        (url) => ALLOWED_URL_SCHEMES.some(scheme => url.startsWith(scheme)),
        { message: 'Only HTTP and HTTPS URLs are allowed' }
      ),
      start: z.number().int().min(0).optional().default(0),
      length: z.number().int().min(1).max(CONFIG.MAX_FETCH_SIZE_BYTES).optional().default(CONFIG.DEFAULT_FETCH_SIZE_BYTES),
      headers: z.record(z.string()).optional().default({}),
    });

    const { url, start, length, headers } = schema.parse(args);

    // Sanitize headers - only allow safe headers
    const sanitizedHeaders = Object.fromEntries(
      Object.entries(headers).filter(([key]) =>
        ALLOWED_HTTP_HEADERS.includes(key as any)
      )
    );

    const rangeHeader = `bytes=${start}-${start + length - 1}`;
    const requestHeaders = {
      ...sanitizedHeaders,
      'Range': rangeHeader,
      'User-Agent': SERVER_INFO.USER_AGENT,
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const dataBase64 = Buffer.from(arrayBuffer).toString('base64');

      const contentRange = response.headers.get('content-range');
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      const result = {
        url,
        ok: response.ok,
        status: response.status,
        contentType,
        requested: { start, end: start + length - 1 },
        receivedBytes: arrayBuffer.byteLength,
        contentRange: contentRange || `bytes ${start}-${start + arrayBuffer.byteLength - 1}/*`,
        totalBytes: contentRange ? parseInt(contentRange.split('/')[1]) : null,
        encoding: 'base64',
        dataBase64,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching chunk: ${errorMessage}`,
          },
        ],
      };
    }
  }

  /**
   * Execute Q CLI command in a specific directory with optional input
   * This is the unified method that replaces the previous duplicated code
   * @param args - Command arguments
   * @param workingDir - Working directory for command execution
   * @param input - Optional input to send to stdin
   * @returns Command output
   */
  private async executeQCommandInDirectory(
    args: string[],
    workingDir: string,
    input?: string
  ): Promise<{ stdout: string; stderr: string }> {
    this.validateCommandArgs(args);

    return new Promise((resolve, reject) => {
      const child = spawn('q', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir,
        env: { ...process.env },
        detached: true,
        timeout: CONFIG.COMMAND_TIMEOUT_MS
      });

      this.activeProcesses.add(child);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > CONFIG.MAX_OUTPUT_SIZE_BYTES) {
          child.kill();
          reject(new Error('Output size limit exceeded'));
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > CONFIG.MAX_OUTPUT_SIZE_BYTES) {
          child.kill();
          reject(new Error('Error output size limit exceeded'));
        }
      });

      const cleanup = () => {
        this.activeProcesses.delete(child);
      };

      child.on('error', (error) => {
        cleanup();
        reject(new Error(`Failed to execute Q CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        cleanup();
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Q CLI exited with code ${code}: ${stderr}`));
        }
      });

      // Write input to stdin and close it
      if (input) {
        child.stdin.write(input + '\n');
      }
      child.stdin.end();
    });
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    await this.initialize();

    this.sessionLogger.logActivity(LOG_TYPES.TRANSPORT_INIT, 'Initializing stdio transport');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.sessionLogger.logActivity(LOG_TYPES.SERVER_CONNECTED, 'Server connected and running on stdio', {
      sessionId: this.sessionLogger.getSessionId(),
      claudeInstance: this.sessionLogger.getClaudeInstance()
    });

    // Clean up stale sessions from previous runs
    const cleanedCount = AmazonQSessionLogger.cleanupStaleSessionsFromRegistry();
    if (cleanedCount > 0) {
      this.sessionLogger.logActivity(LOG_TYPES.CLEANUP, `Cleaned up ${cleanedCount} stale sessions`);
    }

    console.error('[Amazon Q MCP] Amazon Q CLI MCP Server listening on stdio');
  }
}

// Start the server
const server = new AmazonQMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  // Try to log the error if session logger exists
  try {
    if ((server as any).sessionLogger) {
      (server as any).sessionLogger.logActivity(LOG_TYPES.STARTUP_ERROR, 'Failed to start server', {
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
