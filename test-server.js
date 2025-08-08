#!/usr/bin/env node

/**
 * Simple test script to verify the Amazon Q CLI MCP Server works
 */

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

  let serverOutput = '';
  server.stdout.on('data', (data) => {
    serverOutput += data.toString();
  });

  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });

  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 1: List tools
  console.log('Test 1: Listing available tools...');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Test 2: Get help
  console.log('Test 2: Getting help...');
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

  // Test 3: Check status
  console.log('Test 3: Checking status...');
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

  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\nServer output:');
  console.log(serverOutput);

  // Clean up
  server.kill();
  console.log('\nTest completed.');
}

testMCPServer().catch(console.error);
