#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Testing Amazon Q CLI MCP Server Session Logging...\n');

// Start the server
const server = spawn('node', ['dist/server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverOutput = '';
const responses = [];

// Collect server output
server.stdout.on('data', (data) => {
  serverOutput += data.toString();
  // Try to parse JSON responses
  const lines = serverOutput.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line.trim());
        responses.push(response);
        console.log('✓ Received response:', response.id || 'unknown');
      } catch {
        // Not JSON, ignore
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  console.log('Server stderr:', error.trim());
});

// Wait a moment for server to start
setTimeout(async () => {
  console.log('\n=== Test 1: Initialize MCP connection ===');
  
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  }) + '\n';
  
  server.stdin.write(initRequest);

  setTimeout(() => {
    console.log('\n=== Test 2: Check server status ===');
    const statusRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'q_status',
        arguments: {}
      }
    }) + '\n';
    
    server.stdin.write(statusRequest);

    setTimeout(() => {
      console.log('\n=== Test Results ===');
      console.log(`Total responses received: ${responses.length}`);
      
      // Check log directory
      const logDir = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'sessions');
      const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');
      
      console.log('\n=== Checking Log Files ===');
      
      try {
        if (fs.existsSync(logDir)) {
          const logFiles = fs.readdirSync(logDir);
          console.log(`✓ Found ${logFiles.length} session log files:`);
          logFiles.forEach(file => {
            console.log(`  - ${file}`);
            
            // Show first few log lines
            const filePath = path.join(logDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            console.log(`    First few entries (${lines.length} total):`);
            lines.slice(0, 3).forEach((line, i) => {
              try {
                const entry = JSON.parse(line);
                console.log(`    ${i + 1}. [${entry.type}] ${entry.message}`);
              } catch {
                console.log(`    ${i + 1}. ${line.substring(0, 80)}...`);
              }
            });
            console.log('');
          });
        } else {
          console.log('❌ Log directory not found');
        }
        
        if (fs.existsSync(sessionsFile)) {
          const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
          console.log(`✓ Active sessions registry found with ${Object.keys(sessions).length} sessions:`);
          Object.values(sessions).forEach(session => {
            console.log(`  - Session: ${session.sessionId}`);
            console.log(`    Claude Instance: ${session.claudeInstance}`);
            console.log(`    Status: ${session.status}`);
            console.log(`    PID: ${session.pid}`);
            console.log(`    Project: ${session.projectPath}`);
            console.log('');
          });
        } else {
          console.log('❌ Sessions registry not found');
        }
        
      } catch (error) {
        console.log('❌ Error checking logs:', error.message);
      }

      console.log('\n✅ Session logging test completed');
      server.kill();
      process.exit(0);
    }, 2000);
  }, 2000);
}, 1000);

// Handle server exit
server.on('close', (code) => {
  console.log(`\nServer process exited with code ${code}`);
});

// Handle test timeout
setTimeout(() => {
  console.log('\n⏰ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);