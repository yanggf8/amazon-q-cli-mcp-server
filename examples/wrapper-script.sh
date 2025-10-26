#!/bin/bash
# Amazon Q CLI MCP Server wrapper script
# Use this if you encounter GLIBC version conflicts with Rovo Dev CLI

# Clear LD_LIBRARY_PATH to avoid library conflicts
unset LD_LIBRARY_PATH

# Execute the MCP server
exec amazon-q-mcp-server "$@"
