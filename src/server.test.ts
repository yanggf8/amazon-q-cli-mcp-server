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
    it('should validate q_chat parameters', async () => {
      const validArgs = {
        message: 'Hello Amazon Q',
        agent: 'default',
        no_interactive: true,
      };

      // Mock successful execution
      const mockChild = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('Response from Q')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => event === 'close' && cb(0)),
        stdin: { end: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleQChat(validArgs);
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Amazon Q Response:');
    });

    it('should reject invalid q_chat parameters', async () => {
      const invalidArgs = {
        // Missing required 'message' field
        agent: 'default',
      };

      await expect((server as any).handleQChat(invalidArgs)).rejects.toThrow();
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
        stdin: { end: vi.fn(), write: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleQTranslate(validArgs, 'test-session');
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Natural Language Translation:');
    });

    it('should handle q_get_help', async () => {
      const validArgs = {
        command: 'chat',
      };

      // Mock successful execution
      const mockChild = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('Help output')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => event === 'close' && cb(0)),
        stdin: { end: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleQGetHelp(validArgs);
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Amazon Q CLI Help:');
    });

    it('should handle q_check_status', async () => {
      // Mock successful execution for version check
      const mockChild = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('q 1.13.1')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => event === 'close' && cb(0)),
        stdin: { end: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const result = await (server as any).handleQCheckStatus();
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Amazon Q CLI Status:');
    });
  });
});
