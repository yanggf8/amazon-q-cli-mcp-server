import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { CONFIG, LOG_TYPES } from './constants.js';

interface SessionData {
  sessionId: string;
  claudeInstance: string;
  pid: number;
  startTime: number;
  lastActivity: number;
  projectPath: string;
  status: 'starting' | 'ready' | 'error' | 'shutdown';
}

interface LogEntry {
  timestamp: string;
  sessionId: string;
  claudeInstance: string;
  pid: number;
  type: string;
  message: string;
  metadata?: any;
}

/**
 * Session logger for Amazon Q MCP Server
 *
 * Handles session tracking, activity logging, and registry management
 * with proper cleanup and stale session detection.
 */
export class AmazonQSessionLogger {
  private logDir: string;
  private sessionId: string;
  private sessionLogFile: string;
  private claudeInstance: string;
  private sessionsRegistryFile: string;
  private sessionData: SessionData;
  private logWriteCount = 0;
  private cleanupCompleted = false;

  /**
   * Create a new session logger
   * @param projectPath - Working directory path for this session
   */
  constructor(projectPath: string = process.cwd()) {
    // Create logs directory structure
    this.logDir = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'sessions');
    this.sessionsRegistryFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');

    // Ensure directories exist
    fs.mkdirSync(this.logDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.sessionsRegistryFile), { recursive: true });

    // Generate session identifiers
    this.sessionId = this.generateSessionId();
    this.claudeInstance = this.detectClaudeInstance();
    this.sessionLogFile = path.join(this.logDir, `${this.sessionId}.log`);

    // Initialize session data
    this.sessionData = {
      sessionId: this.sessionId,
      claudeInstance: this.claudeInstance,
      pid: process.pid,
      startTime: Date.now(),
      lastActivity: Date.now(),
      projectPath: projectPath,
      status: 'starting'
    };

    // Register session and start logging
    this.registerSession();
    this.logActivity(LOG_TYPES.SESSION_START, `Amazon Q MCP Server started (PID: ${process.pid})`, {
      projectPath,
      claudeInstance: this.claudeInstance,
      nodeVersion: process.version,
      platform: process.platform
    });

    // Setup cleanup handlers
    this.setupCleanupHandlers();
  }

  /**
   * Generate a unique session ID using UUID
   * @returns Unique session identifier
   */
  private generateSessionId(): string {
    return `amazon-q-${randomUUID()}`;
  }

  /**
   * Detect the Claude instance that spawned this process
   * @returns Claude instance identifier
   */
  private detectClaudeInstance(): string {
    try {
      // Priority order for Claude Code instance detection
      const methods = [
        () => process.env.CLAUDE_SESSION_ID,
        () => process.env.CLAUDE_MCP_SESSION,
        () => process.env.CLAUDE_DESKTOP_SESSION,
        () => `claude-${process.ppid}`,
        () => `claude-time-${Date.now()}`
      ];

      for (const method of methods) {
        const result = method();
        if (result && result !== 'undefined') {
          return result;
        }
      }

      return `unknown-claude-${Date.now()}`;
    } catch (error) {
      return `error-claude-${Date.now()}`;
    }
  }

  /**
   * Register this session in the global registry
   */
  private registerSession(): void {
    try {
      let sessions: Record<string, SessionData> = {};

      if (fs.existsSync(this.sessionsRegistryFile)) {
        const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
        sessions = JSON.parse(data);
      }

      sessions[this.sessionId] = this.sessionData;
      fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
      // Silent failure to avoid disrupting MCP protocol
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SESSION ERROR] Failed to register session: ${errorMsg}`);
      this.logActivity(LOG_TYPES.REGISTRY_ERROR, 'Failed to register session', {
        error: errorMsg
      });
    }
  }

  /**
   * Update session activity timestamp in registry
   */
  private updateSession(): void {
    try {
      this.sessionData.lastActivity = Date.now();

      if (fs.existsSync(this.sessionsRegistryFile)) {
        const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
        const sessions = JSON.parse(data);
        sessions[this.sessionId] = this.sessionData;
        fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
      }
    } catch (error) {
      // Silent failure to avoid disrupting MCP protocol
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SESSION ERROR] Failed to update session: ${errorMsg}`);
    }
  }

  /**
   * Log an activity to the session log file
   * @param type - Activity type identifier
   * @param message - Human-readable activity message
   * @param metadata - Optional structured data about the activity
   */
  logActivity(type: string, message: string, metadata?: any): void {
    try {
      // Check log file size periodically
      this.logWriteCount++;
      if (this.logWriteCount % CONFIG.LOG_SIZE_CHECK_INTERVAL === 0) {
        this.checkAndRotateLog();
      }

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        claudeInstance: this.claudeInstance,
        pid: process.pid,
        type,
        message,
        metadata: metadata || {}
      };

      // Write ONLY to file (no console/stderr output)
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.sessionLogFile, logLine);

      // Update session activity
      this.updateSession();

    } catch (error) {
      // Complete silent failure to prevent infinite loops
      // No console.error or stderr output that could interfere with MCP
      try {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorLogEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          claudeInstance: this.claudeInstance,
          pid: process.pid,
          type: LOG_TYPES.LOG_ERROR,
          message: 'Failed to write log entry',
          metadata: {
            originalType: type,
            originalMessage: message,
            error: errorMsg
          }
        };
        fs.appendFileSync(this.sessionLogFile, JSON.stringify(errorLogEntry) + '\n');
      } catch {
        // Complete silent failure if file system has issues
      }
    }
  }

  /**
   * Check log file size and rotate if needed
   */
  private checkAndRotateLog(): void {
    try {
      if (fs.existsSync(this.sessionLogFile)) {
        const stats = fs.statSync(this.sessionLogFile);
        if (stats.size > CONFIG.LOG_SIZE_LIMIT_BYTES) {
          const rotatedFile = `${this.sessionLogFile}.${Date.now()}.old`;
          fs.renameSync(this.sessionLogFile, rotatedFile);
          this.logActivity(LOG_TYPES.LOG_ROTATED, 'Log file rotated due to size limit', {
            oldSize: stats.size,
            rotatedFile: path.basename(rotatedFile)
          });
        }
      }
    } catch (error) {
      // Ignore rotation errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[LOG ERROR] Failed to rotate log: ${errorMsg}`);
    }
  }

  /**
   * Update session status
   * @param status - New status to set
   */
  updateStatus(status: SessionData['status']): void {
    this.sessionData.status = status;
    this.updateSession();
    this.logActivity(LOG_TYPES.STATUS_CHANGE, `Status changed to: ${status}`);
  }

  /**
   * Get session information
   * @returns Copy of session data
   */
  getSessionInfo(): SessionData {
    return { ...this.sessionData };
  }

  /**
   * Get session ID
   * @returns Session identifier
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get Claude instance identifier
   * @returns Claude instance ID
   */
  getClaudeInstance(): string {
    return this.claudeInstance;
  }

  /**
   * Get all active sessions from the registry
   * @returns Record of active sessions
   */
  static getActiveSessions(): Record<string, SessionData> {
    const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');

    if (!fs.existsSync(sessionsFile)) {
      return {};
    }

    try {
      const data = fs.readFileSync(sessionsFile, 'utf8');
      const sessions = JSON.parse(data);

      // Filter out stale sessions
      const now = Date.now();

      const activeSessions: Record<string, SessionData> = {};
      for (const [sessionId, session] of Object.entries(sessions)) {
        const typedSession = session as SessionData;
        if (now - typedSession.lastActivity < CONFIG.STALE_SESSION_CUTOFF_MS) {
          activeSessions[sessionId] = typedSession;
        }
      }

      return activeSessions;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SESSION ERROR] Failed to read active sessions: ${errorMsg}`);
      return {};
    }
  }

  /**
   * Clean up stale sessions from registry
   * @returns Number of cleaned sessions
   */
  static cleanupStaleSessionsFromRegistry(): number {
    const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');

    if (!fs.existsSync(sessionsFile)) {
      return 0;
    }

    try {
      const data = fs.readFileSync(sessionsFile, 'utf8');
      const sessions = JSON.parse(data);

      const now = Date.now();

      let cleanedCount = 0;
      const activeSessions: Record<string, SessionData> = {};

      for (const [sessionId, session] of Object.entries(sessions)) {
        const typedSession = session as SessionData;
        if (now - typedSession.lastActivity < CONFIG.STALE_SESSION_CUTOFF_MS) {
          activeSessions[sessionId] = typedSession;
        } else {
          cleanedCount++;
        }
      }

      fs.writeFileSync(sessionsFile, JSON.stringify(activeSessions, null, 2));
      return cleanedCount;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SESSION ERROR] Failed to cleanup stale sessions: ${errorMsg}`);
      return 0;
    }
  }

  /**
   * Setup cleanup handlers for process termination
   * Includes guard against duplicate cleanup
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      // Guard against duplicate cleanup
      if (this.cleanupCompleted) {
        return;
      }
      this.cleanupCompleted = true;

      this.logActivity(LOG_TYPES.SESSION_END, 'Amazon Q MCP Server shutting down');

      try {
        if (fs.existsSync(this.sessionsRegistryFile)) {
          const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
          const sessions = JSON.parse(data);
          delete sessions[this.sessionId];
          fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
        }
      } catch (error) {
        // Silent failure during cleanup
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CLEANUP ERROR] Failed during cleanup: ${errorMsg}`);
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    // Guard against duplicate cleanup
    if (this.cleanupCompleted) {
      return;
    }

    this.updateStatus('shutdown');
    this.logActivity(LOG_TYPES.SESSION_CLEANUP, 'Manual cleanup initiated');

    try {
      if (fs.existsSync(this.sessionsRegistryFile)) {
        const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
        const sessions = JSON.parse(data);
        delete sessions[this.sessionId];
        fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
      }
    } catch (error) {
      // Silent failure during cleanup
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[CLEANUP ERROR] Failed during manual cleanup: ${errorMsg}`);
    }

    this.cleanupCompleted = true;
  }
}
