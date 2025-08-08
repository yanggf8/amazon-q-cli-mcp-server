#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testChatFunctionality() {
  console.log('Testing Amazon Q CLI MCP Server Chat Functionality...\n');

  // Start the MCP server
  const serverPath = join(__dirname, 'dist', 'server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Server response:', output);
  });

  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test chat functionality
  console.log('=== Testing Q Chat ===');
  const chatRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'q_chat',
      arguments: {
        message: 'What is Amazon S3?',
        no_interactive: true
      }
    }
  };

  server.stdin.write(JSON.stringify(chatRequest) + '\n');

  // Wait for response (chat might take longer)
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test translate functionality
  console.log('\n=== Testing Q Translate ===');
  const translateRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'q_translate',
      arguments: {
        query: 'list all files in current directory'
      }
    }
  };

  server.stdin.write(JSON.stringify(translateRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Clean up
  server.kill();
  console.log('\n=== Chat test completed ===');
}

testChatFunctionality().catch(console.error);
