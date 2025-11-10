#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

console.error('DEBUG: Starting Amazon Q CLI MCP Server...');

const server = new Server(
  {
    name: 'amazon-q-cli-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error('DEBUG: Server created');

server.onerror = (error) => {
  console.error('DEBUG: Server error:', error);
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('DEBUG: Received tools/list request');
  return {
    tools: [
      {
        name: 'q_check_status',
        description: 'Check Amazon Q CLI status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('DEBUG: Received tool call:', request.params.name);
  return {
    content: [
      {
        type: 'text',
        text: 'Debug response from Amazon Q MCP server',
      },
    ],
  };
});

const transport = new StdioServerTransport();
console.error('DEBUG: Connecting to transport...');

await server.connect(transport);
console.error('DEBUG: Amazon Q CLI MCP Server running on stdio');
