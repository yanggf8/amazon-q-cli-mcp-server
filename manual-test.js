#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPServer() {
  console.log('Testing Amazon Q CLI MCP Server...\n');

  // Start the MCP server
  const serverPath = join(__dirname, 'dist', 'server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responses = [];

  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Server stdout:', output);
    
    // Try to parse JSON responses
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log('Parsed response:', JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON, ignore
      }
    }
  });

  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 1: List tools
  console.log('\n=== Test 1: Listing tools ===');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Get help
  console.log('\n=== Test 2: Getting help ===');
  const getHelpRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'q_get_help',
      arguments: {}
    }
  };

  server.stdin.write(JSON.stringify(getHelpRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Check status
  console.log('\n=== Test 3: Checking status ===');
  const checkStatusRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'q_check_status',
      arguments: {}
    }
  };

  server.stdin.write(JSON.stringify(checkStatusRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clean up
  server.kill();
  console.log('\n=== Test completed ===');
  console.log(`Received ${responses.length} responses`);
}

testMCPServer().catch(console.error);
