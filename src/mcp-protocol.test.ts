import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MCP Protocol Compliance', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    // Start the MCP server
    const serverPath = join(__dirname, '..', 'dist', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 10000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to tools/list with proper MCP format', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const response = await sendMCPRequest(request);
    
    // Verify MCP protocol compliance
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 1);
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('tools');
    expect(Array.isArray(response.result.tools)).toBe(true);
    
    // Verify each tool has required properties
    for (const tool of response.result.tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.inputSchema).toBe('object');
    }

    // Verify specific tools exist (updated to match our actual implementation)
    const toolNames = response.result.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('ask_q');
    expect(toolNames).toContain('q_translate');
    expect(toolNames).toContain('q_status');
  });

  it('should handle invalid tool calls gracefully', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nonexistent_tool',
        arguments: {}
      }
    };

    const response = await sendMCPRequest(request);
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 2);
    
    // Should return content with error message (our implementation returns error in content)
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content[0].text).toContain('Unknown tool');
    } else if (response.error) {
      // This is also acceptable
      expect(response.error).toHaveProperty('message');
    }
  });

  it('should validate tool arguments', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'ask_q',
        arguments: {
          // Missing required 'prompt' field
          model: 'claude-3-sonnet'
        }
      }
    };

    const response = await sendMCPRequest(request);
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 3);
    
    // Should return content with error message (our implementation returns error in content)
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content[0].text).toContain('Invalid parameters');
    } else if (response.error) {
      // This is also acceptable
      expect(response.error).toHaveProperty('message');
    }
  });

  async function sendMCPRequest(request: any): Promise<any> {
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
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!responseReceived) {
          serverProcess.stdout?.off('data', onData);
          reject(new Error(`Request timeout for ${request.method} (id: ${request.id})`));
        }
      }, 5000);
    });
  }
});
