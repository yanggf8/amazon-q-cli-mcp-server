#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Starting MCP server test...');

const server = spawn('amazon-q-mcp-server', [], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

server.stdout.on('data', (data) => {
  console.log('Server stdout:', data.toString());
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

server.on('close', (code) => {
  console.log('Server closed with code:', code);
});

// Wait for server to start
setTimeout(() => {
  console.log('Sending tools/list request...');
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }) + '\n';
  
  server.stdin.write(request);
}, 1000);

// Clean up after 5 seconds
setTimeout(() => {
  console.log('Cleaning up...');
  server.kill();
  process.exit(0);
}, 5000);
