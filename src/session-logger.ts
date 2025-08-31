import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

export class AmazonQSessionLogger {
  private logDir: string;
  private sessionId: string;
  private sessionLogFile: string;
  private claudeInstance: string;
  private sessionsRegistryFile: string;
  private sessionData: SessionData;
  private maxLogSizeBytes = 50 * 1024 * 1024; // 50MB per log file
  private logWriteCount = 0;
  private logSizeCheckInterval = 100; // Check every 100 log writes

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
    this.logActivity('SESSION_START', `Amazon Q MCP Server started (PID: ${process.pid})`, {
      projectPath,
      claudeInstance: this.claudeInstance,
      nodeVersion: process.version,
      platform: process.platform
    });

    // Setup cleanup handlers
    this.setupCleanupHandlers();
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `amazon-q-${timestamp}-${random}`;
  }

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
      this.logActivity('REGISTRY_ERROR', 'Failed to register session', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

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
    }
  }

  logActivity(type: string, message: string, metadata?: any): void {
    try {
      // Check log file size periodically
      this.logWriteCount++;
      if (this.logWriteCount % this.logSizeCheckInterval === 0) {
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
        const errorLogEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          claudeInstance: this.claudeInstance,
          pid: process.pid,
          type: 'LOG_ERROR',
          message: 'Failed to write log entry',
          metadata: { 
            originalType: type,
            originalMessage: message,
            error: error instanceof Error ? error.message : String(error)
          }
        };
        fs.appendFileSync(this.sessionLogFile, JSON.stringify(errorLogEntry) + '\n');
      } catch {
        // Complete silent failure if file system has issues
      }
    }
  }

  private checkAndRotateLog(): void {
    try {
      if (fs.existsSync(this.sessionLogFile)) {
        const stats = fs.statSync(this.sessionLogFile);
        if (stats.size > this.maxLogSizeBytes) {
          const rotatedFile = `${this.sessionLogFile}.${Date.now()}.old`;
          fs.renameSync(this.sessionLogFile, rotatedFile);
          this.logActivity('LOG_ROTATED', 'Log file rotated due to size limit', {
            oldSize: stats.size,
            rotatedFile: path.basename(rotatedFile)
          });
        }
      }
    } catch {
      // Ignore rotation errors
    }
  }

  updateStatus(status: SessionData['status']): void {
    this.sessionData.status = status;
    this.updateSession();
    this.logActivity('STATUS_CHANGE', `Status changed to: ${status}`);
  }

  getSessionInfo(): SessionData {
    return { ...this.sessionData };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getClaudeInstance(): string {
    return this.claudeInstance;
  }

  static getActiveSessions(): Record<string, SessionData> {
    const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');
    
    if (!fs.existsSync(sessionsFile)) {
      return {};
    }

    try {
      const data = fs.readFileSync(sessionsFile, 'utf8');
      const sessions = JSON.parse(data);
      
      // Filter out stale sessions (older than 15 minutes with no activity)
      const now = Date.now();
      const staleCutoff = 15 * 60 * 1000; // 15 minutes
      
      const activeSessions: Record<string, SessionData> = {};
      for (const [sessionId, session] of Object.entries(sessions)) {
        const typedSession = session as SessionData;
        if (now - typedSession.lastActivity < staleCutoff) {
          activeSessions[sessionId] = typedSession;
        }
      }
      
      return activeSessions;
    } catch (error) {
      return {};
    }
  }

  static cleanupStaleSessionsFromRegistry(): number {
    const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');
    
    if (!fs.existsSync(sessionsFile)) {
      return 0;
    }

    try {
      const data = fs.readFileSync(sessionsFile, 'utf8');
      const sessions = JSON.parse(data);
      
      const now = Date.now();
      const staleCutoff = 15 * 60 * 1000; // 15 minutes
      
      let cleanedCount = 0;
      const activeSessions: Record<string, SessionData> = {};
      
      for (const [sessionId, session] of Object.entries(sessions)) {
        const typedSession = session as SessionData;
        if (now - typedSession.lastActivity < staleCutoff) {
          activeSessions[sessionId] = typedSession;
        } else {
          cleanedCount++;
        }
      }
      
      fs.writeFileSync(sessionsFile, JSON.stringify(activeSessions, null, 2));
      return cleanedCount;
    } catch (error) {
      return 0;
    }
  }

  private setupCleanupHandlers(): void {
    const cleanup = () => {
      this.logActivity('SESSION_END', 'Amazon Q MCP Server shutting down');
      
      try {
        if (fs.existsSync(this.sessionsRegistryFile)) {
          const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
          const sessions = JSON.parse(data);
          delete sessions[this.sessionId];
          fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
        }
      } catch {
        // Silent failure during cleanup
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

  cleanup(): void {
    this.updateStatus('shutdown');
    this.logActivity('SESSION_CLEANUP', 'Manual cleanup initiated');
    
    try {
      if (fs.existsSync(this.sessionsRegistryFile)) {
        const data = fs.readFileSync(this.sessionsRegistryFile, 'utf8');
        const sessions = JSON.parse(data);
        delete sessions[this.sessionId];
        fs.writeFileSync(this.sessionsRegistryFile, JSON.stringify(sessions, null, 2));
      }
    } catch {
      // Silent failure during cleanup
    }
  }
}