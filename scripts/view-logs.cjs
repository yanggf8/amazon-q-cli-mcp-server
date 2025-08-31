#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function viewAmazonQLogs() {
  const logDir = path.join(os.homedir(), '.amazon-q-mcp', 'logs');
  const sessionsDir = path.join(logDir, 'sessions');
  const sessionsFile = path.join(logDir, 'active-sessions.json');

  console.log('=== Amazon Q CLI MCP Server Logs ===\n');

  // Show active sessions
  if (fs.existsSync(sessionsFile)) {
    try {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      const sessionCount = Object.keys(sessions).length;
      
      console.log(`📊 Active Sessions: ${sessionCount}\n`);
      
      if (sessionCount > 0) {
        Object.values(sessions).forEach((session, index) => {
          const uptime = Math.round((Date.now() - session.startTime) / 1000);
          const lastActivity = Math.round((Date.now() - session.lastActivity) / 1000);
          
          console.log(`${index + 1}. Session: ${session.sessionId}`);
          console.log(`   Claude Instance: ${session.claudeInstance}`);
          console.log(`   PID: ${session.pid} | Status: ${session.status}`);
          console.log(`   Project: ${session.projectPath}`);
          console.log(`   Uptime: ${uptime}s | Last Activity: ${lastActivity}s ago`);
          console.log('');
        });
      }
    } catch (error) {
      console.log('❌ Error reading sessions file:', error.message);
    }
  } else {
    console.log('📊 Active Sessions: 0 (no registry file)\n');
  }

  // Show session logs
  if (fs.existsSync(sessionsDir)) {
    const logFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.log'));
    console.log(`📝 Session Log Files: ${logFiles.length}\n`);

    if (logFiles.length > 0) {
      // Show most recent logs from each session
      logFiles.forEach((file, index) => {
        console.log(`--- ${file} ---`);
        
        try {
          const filePath = path.join(sessionsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            // Show first entry (session start)
            try {
              const firstEntry = JSON.parse(lines[0]);
              console.log(`Start: ${firstEntry.timestamp} - ${firstEntry.message}`);
            } catch {}
            
            // Show last few entries
            const recentLines = lines.slice(-3);
            console.log(`Recent activity (${lines.length} total entries):`);
            recentLines.forEach((line, i) => {
              try {
                const entry = JSON.parse(line);
                const time = new Date(entry.timestamp).toLocaleTimeString();
                console.log(`  ${time} [${entry.type}] ${entry.message}`);
              } catch {
                console.log(`  ${line.substring(0, 80)}...`);
              }
            });
          } else {
            console.log('  (empty log file)');
          }
          
        } catch (error) {
          console.log(`  Error reading log: ${error.message}`);
        }
        
        console.log('');
      });
      
      // Show usage instructions
      console.log('💡 To view a specific session log:');
      console.log(`   tail -f ~/.amazon-q-mcp/logs/sessions/SESSION_ID.log`);
      console.log('');
      console.log('💡 To view all logs in real-time:');
      console.log(`   tail -f ~/.amazon-q-mcp/logs/sessions/*.log`);
    }
  } else {
    console.log('📝 Session Log Files: 0 (no logs directory)\n');
  }

  console.log('=== Log Directory Structure ===');
  console.log(`📁 ${logDir}`);
  console.log(`   ├── 📁 sessions/          # Individual session logs`);
  console.log(`   └── 📄 active-sessions.json # Session registry`);
}

// Run if called directly
if (require.main === module) {
  viewAmazonQLogs();
}

module.exports = { viewAmazonQLogs };