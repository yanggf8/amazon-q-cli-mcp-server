#!/usr/bin/env node

const { spawn } = require('child_process');

// Test the updated MCP server
function testMCPServer() {
  console.log('Testing updated MCP server...');
  
  const server = spawn('node', ['dist/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Test ask_q tool
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'ask_q',
      arguments: {
        prompt: 'What is AWS S3?'
      }
    }
  };

  server.stdin.write(JSON.stringify(testRequest) + '\n');

  let output = '';
  server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server output:', data.toString());
  });

  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
  });

  // Close after 10 seconds
  setTimeout(() => {
    server.kill();
  }, 10000);
}

testMCPServer();
