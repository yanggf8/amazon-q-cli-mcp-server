#!/usr/bin/env node

import { spawn } from 'child_process';

async function testTool(toolName, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing ${toolName}...`);
    
    const server = spawn('node', ['dist/server-fixed.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const testRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    let output = '';
    let hasResponse = false;

    server.stdout.on('data', (data) => {
      output += data.toString();
      
      // Look for JSON response
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{') && line.includes('"result"')) {
          try {
            const response = JSON.parse(line.trim());
            console.log(`✅ ${toolName} response:`, response.result?.content?.[0]?.text?.substring(0, 200) + '...');
            hasResponse = true;
            server.kill();
            resolve(response);
            return;
          } catch (e) {
            // Continue looking
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      console.log(`${toolName} stderr:`, data.toString());
    });

    server.on('close', (code) => {
      if (!hasResponse) {
        console.log(`❌ ${toolName} failed - no response received`);
        reject(new Error(`No response for ${toolName}`));
      }
    });

    // Send the request
    server.stdin.write(JSON.stringify(testRequest) + '\n');

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!hasResponse) {
        server.kill();
        console.log(`⏰ ${toolName} timed out`);
        reject(new Error(`Timeout for ${toolName}`));
      }
    }, 15000);
  });
}

async function runTests() {
  console.log('🚀 Testing FIXED Amazon Q CLI MCP Server...\n');

  const tests = [
    {
      name: 'ask_q',
      args: { prompt: 'What is AWS Lambda?' }
    },
    {
      name: 'q_translate',
      args: { task: 'list all files in current directory' }
    },
    {
      name: 'q_status',
      args: {}
    }
  ];

  for (const test of tests) {
    try {
      await testTool(test.name, test.args);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    } catch (error) {
      console.error(`❌ Test failed for ${test.name}:`, error.message);
    }
  }

  console.log('\n✨ Testing complete!');
}

runTests().catch(console.error);
