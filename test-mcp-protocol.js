#!/usr/bin/env node

/**
 * Comprehensive MCP Protocol Test for Amazon Q CLI MCP Server
 * Tests initialization, tool listing, and tool execution
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let messageId = 1;

function createMCPRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
}

async function testMCPServer() {
  console.log('=== Amazon Q CLI MCP Server Protocol Test ===\n');

  const serverPath = join(__dirname, 'dist', 'server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responses = [];
  let serverErrors = [];

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log(`✓ Received response for ID ${response.id || 'unknown'}`);
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });

  server.stderr.on('data', (data) => {
    const error = data.toString().trim();
    serverErrors.push(error);
    console.log('Server stderr:', error);
  });

  server.on('error', (error) => {
    console.error('Server process error:', error);
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('🔄 Step 1: Initialize MCP connection');
  const initRequest = createMCPRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {
      roots: {
        listChanged: true
      },
      sampling: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });

  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🔄 Step 2: List available tools');
  const listToolsRequest = createMCPRequest('tools/list');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🔄 Step 3: Test q_status tool');
  const statusRequest = createMCPRequest('tools/call', {
    name: 'q_status',
    arguments: {}
  });
  server.stdin.write(JSON.stringify(statusRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🔄 Step 4: Test ask_q tool with simple prompt');
  const askQRequest = createMCPRequest('tools/call', {
    name: 'ask_q',
    arguments: {
      prompt: 'What is 2+2?'
    }
  });
  server.stdin.write(JSON.stringify(askQRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Analysis
  console.log('\n=== Test Results ===');
  console.log(`Total responses received: ${responses.length}`);
  console.log(`Server errors: ${serverErrors.length}`);

  if (responses.length === 0) {
    console.log('❌ CRITICAL: No responses received - potential MCP protocol issue');
  }

  responses.forEach((response, index) => {
    console.log(`\nResponse ${index + 1}:`);
    if (response.error) {
      console.log('❌ Error:', response.error);
    } else if (response.result) {
      console.log('✅ Success');
      if (response.result.tools) {
        console.log(`  - Found ${response.result.tools.length} tools`);
      }
      if (response.result.content) {
        console.log(`  - Content type: ${response.result.content[0]?.type}`);
      }
    }
  });

  if (serverErrors.length > 0) {
    console.log('\nServer Errors:');
    serverErrors.forEach(error => console.log('  -', error));
  }

  // Cleanup
  server.kill();
  console.log('\n✅ Test completed');
}

testMCPServer().catch(console.error);