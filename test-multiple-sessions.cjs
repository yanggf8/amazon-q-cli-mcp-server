#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Testing Multiple Amazon Q CLI MCP Server Sessions...\n');

const servers = [];
const serverCount = 3;

// Start multiple servers
for (let i = 0; i < serverCount; i++) {
  console.log(`Starting server ${i + 1}...`);
  
  const server = spawn('node', ['dist/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_SESSION_ID: `test-claude-${i + 1}` }
  });

  server.stderr.on('data', (data) => {
    console.log(`Server ${i + 1} stderr:`, data.toString().trim());
  });

  server.on('close', (code) => {
    console.log(`Server ${i + 1} exited with code ${code}`);
  });

  servers.push(server);
  
  // Send initialize request
  setTimeout(() => {
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: `test-client-${i + 1}`, version: '1.0.0' }
      }
    }) + '\n';
    server.stdin.write(initRequest);
    
    // Send status request
    setTimeout(() => {
      const statusRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'q_status', arguments: {} }
      }) + '\n';
      server.stdin.write(statusRequest);
    }, 500);
  }, i * 200); // Stagger startup
}

// Check results after servers have had time to start
setTimeout(() => {
  console.log('\n=== Checking Multi-Session Logs ===');
  
  const logDir = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'sessions');
  const sessionsFile = path.join(os.homedir(), '.amazon-q-mcp', 'logs', 'active-sessions.json');
  
  try {
    if (fs.existsSync(logDir)) {
      const logFiles = fs.readdirSync(logDir);
      console.log(`✓ Found ${logFiles.length} session log files:`);
      
      logFiles.forEach((file, index) => {
        console.log(`\n--- Session ${index + 1}: ${file} ---`);
        const filePath = path.join(logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        console.log(`  Total log entries: ${lines.length}`);
        
        // Show session details from first entry
        try {
          const firstEntry = JSON.parse(lines[0]);
          console.log(`  Session ID: ${firstEntry.sessionId}`);
          console.log(`  Claude Instance: ${firstEntry.claudeInstance}`);
          console.log(`  PID: ${firstEntry.pid}`);
        } catch (e) {
          console.log(`  Could not parse first entry`);
        }
        
        // Show some activity types
        const activityTypes = new Set();
        lines.slice(0, 10).forEach(line => {
          try {
            const entry = JSON.parse(line);
            activityTypes.add(entry.type);
          } catch {}
        });
        console.log(`  Activity types: ${Array.from(activityTypes).join(', ')}`);
      });
    }
    
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      console.log(`\n✓ Active sessions registry has ${Object.keys(sessions).length} sessions`);
      
      Object.values(sessions).forEach((session, index) => {
        console.log(`\n  Session ${index + 1}:`);
        console.log(`    ID: ${session.sessionId}`);
        console.log(`    Claude Instance: ${session.claudeInstance}`);
        console.log(`    PID: ${session.pid}`);
        console.log(`    Status: ${session.status}`);
        console.log(`    Uptime: ${Math.round((Date.now() - session.startTime) / 1000)}s`);
      });
    }
    
  } catch (error) {
    console.log('❌ Error checking logs:', error.message);
  }

  // Clean up
  console.log('\n=== Cleaning up servers ===');
  servers.forEach((server, i) => {
    console.log(`Stopping server ${i + 1}...`);
    server.kill();
  });

  setTimeout(() => {
    console.log('\n✅ Multiple session test completed');
    process.exit(0);
  }, 1000);
  
}, 3000);

// Handle timeout
setTimeout(() => {
  console.log('\n⏰ Test timed out, cleaning up...');
  servers.forEach(server => server.kill());
  process.exit(1);
}, 10000);