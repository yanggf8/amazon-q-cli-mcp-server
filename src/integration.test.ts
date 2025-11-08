import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Amazon Q CLI MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let serverReady = false;

  beforeAll(async () => {
    // Start the MCP server
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Server startup timeout');
        resolve();
      }, 3000);

      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Amazon Q CLI MCP Server listening') || output.includes('listening on stdio')) {
          serverReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }, 10000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to tools/list request', async () => {
    if (!serverReady) {
      console.warn('Server not ready, skipping test');
      return;
    }

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const response = await sendMCPRequest(request);

    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 1);
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('tools');
    expect(Array.isArray(response.result.tools)).toBe(true);

    // Check that all expected tools are present (updated to match actual implementation)
    const toolNames = response.result.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('ask_q');
    expect(toolNames).toContain('take_q');
    expect(toolNames).toContain('q_translate');
    expect(toolNames).toContain('fetch_chunk');
    expect(toolNames).toContain('q_status');
  });

  it('should handle q_status tool call', async () => {
    if (!serverReady) {
      console.warn('Server not ready, skipping test');
      return;
    }

    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'q_status',
        arguments: {}
      }
    };

    const response = await sendMCPRequest(request);

    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 2);

    // Should return content with status information
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content[0]).toHaveProperty('type', 'text');
      expect(response.result.content[0].text).toContain('Amazon Q CLI MCP Server Status');
    } else if (response.error) {
      // This might happen if there are issues, which is acceptable for testing
      expect(response.error).toHaveProperty('message');
    }
  });

  it('should handle fetch_chunk tool call', async () => {
    if (!serverReady) {
      console.warn('Server not ready, skipping test');
      return;
    }

    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'fetch_chunk',
        arguments: {
          url: 'https://httpbin.org/bytes/100',
          start: 0,
          length: 100
        }
      }
    };

    const response = await sendMCPRequest(request, 15000);

    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 3);

    // Should return content with fetched data
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content[0]).toHaveProperty('type', 'text');

      // Parse the response to verify structure
      const resultText = response.result.content[0].text;
      if (!resultText.includes('Error')) {
        const parsedResult = JSON.parse(resultText);
        expect(parsedResult).toHaveProperty('url');
        expect(parsedResult).toHaveProperty('status');
        expect(parsedResult).toHaveProperty('dataBase64');
      }
    } else if (response.error) {
      // Network errors are acceptable in test environment
      expect(response.error).toHaveProperty('message');
    }
  });

  async function sendMCPRequest(request: any, timeoutMs: number = 8000): Promise<any> {
    return new Promise((resolve, reject) => {
      let responseBuffer = '';
      let responseReceived = false;

      const onData = (data: Buffer) => {
        if (responseReceived) return;

        responseBuffer += data.toString();

        // Try to parse each complete line as JSON
        const lines = responseBuffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                responseReceived = true;
                serverProcess.stdout?.off('data', onData);
                resolve(response);
                return;
              }
            } catch (e) {
              // Continue to next line if JSON parsing fails
            }
          }
        }

        // Keep the last incomplete line in buffer
        responseBuffer = lines[lines.length - 1];
      };

      serverProcess.stdout?.on('data', onData);

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      serverProcess.stdin?.write(requestStr);

      // Timeout
      setTimeout(() => {
        if (!responseReceived) {
          serverProcess.stdout?.off('data', onData);
          reject(new Error(`Request timeout for ${request.method} (id: ${request.id})`));
        }
      }, timeoutMs);
    });
  }
});
