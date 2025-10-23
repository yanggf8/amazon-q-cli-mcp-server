import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { AmazonQMCPServer } from './server.js';

// Mock child_process
vi.mock('child_process');
vi.mock('util');

const mockSpawn = vi.mocked(spawn);

describe('AmazonQMCPServer', () => {
  let server: AmazonQMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new AmazonQMCPServer();
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', () => {
      // This is a basic test to ensure the server can be instantiated
      expect(server).toBeInstanceOf(AmazonQMCPServer);
    });
  });

  describe('Command Execution', () => {
    it('should handle successful command execution', async () => {
      // Mock successful spawn
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('Amazon Q CLI version 1.0.0');
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
        stdin: {
          end: vi.fn(),
        },
      };

      mockSpawn.mockReturnValue(mockChild as any);

      // Test the private method through reflection
      const result = await (server as any).executeQCommand(['--version']);
      
      expect(result.stdout).toBe('Amazon Q CLI version 1.0.0');
      expect(mockSpawn).toHaveBeenCalledWith('q', ['--version'], expect.any(Object));
    });

    it('should handle command execution errors', async () => {
      // Mock failed spawn
      const mockChild = {
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('Command not found');
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error exit code
          }
        }),
        stdin: {
          end: vi.fn(),
        },
      };

      mockSpawn.mockReturnValue(mockChild as any);

      // Test the private method through reflection
      await expect((server as any).executeQCommand(['--invalid'])).rejects.toThrow();
    });
  });

  describe('Tool Handlers', () => {
    it('should validate ask_q parameters', async () => {
      const validArgs = {
        prompt: 'Hello Amazon Q',
        model: 'claude-3-sonnet',
      };

      // Mock successful execution
      const mockChild = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('Response from Q')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => event === 'close' && cb(0)),
        stdin: { write: vi.fn(), end: vi.fn() },
        pid: 12345
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleAskQ(validArgs);
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Response from Q');
    });

    it('should reject invalid ask_q parameters', async () => {
      const invalidArgs = {
        // Missing required 'prompt' field
        model: 'claude-3-sonnet',
      };

      await expect((server as any).handleAskQ(invalidArgs)).rejects.toThrow();
    });

    it('should handle q_translate', async () => {
      const validArgs = {
        task: 'list all files in current directory',
      };

      // Mock successful execution
      const mockChild = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('ls -la')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => event === 'close' && cb(0)),
        stdin: { write: vi.fn(), end: vi.fn() },
        pid: 12345
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleQTranslate(validArgs, 'test-session');
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('```bash\nls -la\n```');
    });

    it('should handle q_status', async () => {
      const result = await (server as any).handleQStatus({});
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Amazon Q CLI MCP Server Status');
    });
  });
});
