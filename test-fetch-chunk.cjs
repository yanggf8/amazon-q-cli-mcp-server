#!/usr/bin/env node

const { spawn } = require('child_process');

function testFetchChunk() {
    console.log('🧪 Testing fetch_chunk tool...\n');
    
    const server = spawn('node', ['dist/server.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    let responses = [];

    server.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
            try {
                const response = JSON.parse(line);
                responses.push(response);
                responseCount++;
                
                if (response.result && response.result.content) {
                    console.log(`✅ fetch_chunk response received`);
                    const content = response.result.content[0].text;
                    if (content.includes('url') || content.includes('ok')) {
                        console.log(`   Response contains expected fields`);
                    }
                }
            } catch (e) {
                // Ignore non-JSON lines
            }
        });
    });

    server.stderr.on('data', (data) => {
        console.log(`Server stderr: ${data.toString().trim()}`);
    });

    // Initialize MCP connection
    server.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" }
        }
    }) + '\n');

    // Test fetch_chunk with a small HTTP request
    setTimeout(() => {
        server.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "fetch_chunk",
                arguments: {
                    url: "https://httpbin.org/json",
                    start: 0,
                    length: 1024
                }
            }
        }) + '\n');
    }, 100);

    // Clean up after test
    setTimeout(() => {
        server.kill();
        console.log(`\n=== Test Results ===`);
        console.log(`Total responses received: ${responseCount}`);
        console.log(`✅ fetch_chunk test completed`);
    }, 3000);
}

testFetchChunk();
