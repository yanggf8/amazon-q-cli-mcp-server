#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test error recovery patterns
async function testErrorRecovery() {
  console.log('🧪 Testing Error Recovery Patterns');
  console.log('==================================');
  
  const testCases = [
    {
      name: "Valid Request",
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'q_status',
          arguments: {}
        }
      }
    },
    {
      name: "Invalid Tool Name",
      request: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      }
    },
    {
      name: "Invalid Parameters",
      request: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ask_q',
          arguments: {
            // Missing required 'prompt' parameter
            model: 'test-model'
          }
        }
      }
    },
    {
      name: "Q Translate Test",
      request: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'q_translate',
          arguments: {
            task: 'list all files in current directory'
          }
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('─'.repeat(50));
    
    await runSingleTest(testCase.request);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function runSingleTest(request) {
  return new Promise((resolve) => {
    // Start the MCP server
    const serverProcess = spawn('node', [path.join(__dirname, 'dist/server.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let responseReceived = false;
    let responseData = '';
    
    serverProcess.stdout.on('data', (data) => {
      responseData += data.toString();
      
      // Try to parse JSON response
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              console.log('📤 Request:', JSON.stringify(request, null, 2));
              console.log('📨 Response:', JSON.stringify(response, null, 2));
              
              // Analyze error response if present
              if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content.text.includes('❌')) {
                  console.log('🔍 Error Pattern Detected: Enhanced error response with guidance');
                } else {
                  console.log('✅ Success: Normal response received');
                }
              } else if (response.error) {
                console.log('⚠️ JSON-RPC Error:', response.error);
              }
              
              responseReceived = true;
              serverProcess.kill('SIGTERM');
              setTimeout(resolve, 100);
              return;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const logData = data.toString();
      if (logData.includes('[INFO]') || logData.includes('[')) {
        console.log('📝 Server Log:', logData.trim());
      }
    });
    
    serverProcess.on('close', () => {
      if (!responseReceived) {
        console.log('❌ No response received');
        resolve();
      }
    });
    
    // Send the request
    setTimeout(() => {
      console.log('📤 Sending request...');
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
    }, 500);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log('⏰ Test timed out');
        serverProcess.kill('SIGTERM');
        resolve();
      }
    }, 10000);
  });
}

console.log('🚀 Starting Error Recovery Pattern Tests...\n');
testErrorRecovery().then(() => {
  console.log('\n✅ Error Recovery Tests Completed!');
  console.log('📊 Check the responses above to verify error patterns are working correctly.');
  process.exit(0);
}).catch(console.error);