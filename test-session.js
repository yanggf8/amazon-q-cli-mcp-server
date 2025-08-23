#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test session management by simulating MCP calls
async function testSessionManagement() {
  console.log('🧪 Testing Session Management Implementation');
  console.log('==========================================');
  
  // Start the MCP server
  const serverProcess = spawn('node', [path.join(__dirname, 'dist/server.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let serverResponse = '';
  
  serverProcess.stdout.on('data', (data) => {
    serverResponse += data.toString();
    console.log('📨 Server Response:', data.toString().trim());
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.log('📝 Server Log:', data.toString().trim());
  });
  
  // Send tools/list request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  console.log('📤 Sending tools/list request...');
  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Wait for response
  setTimeout(() => {
    // Send ask_q request with session ID
    const askQRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'ask_q',
        arguments: {
          prompt: 'Hello, this is a test message. Remember this for the next message.'
        }
      }
    };
    
    console.log('📤 Sending first ask_q request (Session Test 1)...');
    serverProcess.stdin.write(JSON.stringify(askQRequest) + '\n');
    
    setTimeout(() => {
      // Send second ask_q request to test session persistence
      const askQRequest2 = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ask_q',
          arguments: {
            prompt: 'Do you remember what I just told you?'
          }
        }
      };
      
      console.log('📤 Sending second ask_q request (Session Test 2)...');
      serverProcess.stdin.write(JSON.stringify(askQRequest2) + '\n');
      
      // Clean up after a delay
      setTimeout(() => {
        console.log('🔚 Terminating test...');
        serverProcess.kill('SIGTERM');
        
        console.log('\n✅ Test completed!');
        console.log('📁 Check ~/.amazon-q-mcp/sessions/ for session directories');
        process.exit(0);
      }, 5000);
      
    }, 3000);
    
  }, 2000);
  
  serverProcess.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
  });
}

testSessionManagement().catch(console.error);