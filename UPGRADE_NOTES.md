# Amazon Q CLI MCP Server - Upgrade Notes

## Issue
After Amazon Q CLI upgraded to version 1.13.2, the MCP server stopped working properly due to changes in the CLI behavior.

## Root Cause
The main issue was that the `q translate` command now requires a TTY (terminal) and doesn't work in non-interactive mode, causing the MCP server to fail when trying to execute translation requests.

## Solution
Updated the MCP server to work with the new Amazon Q CLI version by:

### 1. Fixed Translation Tool
- **Problem**: `q translate` command requires TTY and fails in non-interactive mode
- **Solution**: Use `q chat --no-interactive` with a specific prompt to perform translation instead
- **Implementation**: Modified `handleQTranslate()` to use chat command with translation-specific prompts

### 2. Enhanced ask_q Tool
- Added support for new CLI parameters:
  - `--model`: Specify which model to use
  - `--agent`: Specify which agent/context profile to use
- Maintains backward compatibility

### 3. Added New Tools
- **q_status**: Check Amazon Q CLI status using `q doctor`
- **q_list_agents**: List available agents using `q agent list`
- **q_mcp_status**: Check MCP server status using `q mcp list`

## Changes Made

### Updated Tools
1. **ask_q**: Now supports `model` and `agent` parameters
2. **q_translate**: Uses chat command instead of translate command
3. **q_audit**: No changes needed (still works)
4. **q_fix**: No changes needed (still works)

### New Tools
5. **q_status**: Runs diagnostic checks
6. **q_list_agents**: Lists available agents
7. **q_mcp_status**: Shows MCP configuration

## Testing
All tools have been tested and are working correctly with Amazon Q CLI v1.13.2:
- ✅ ask_q - Working with new parameters
- ✅ q_translate - Working with chat-based approach
- ✅ q_audit - Working as before
- ✅ q_fix - Working as before
- ✅ q_status - New tool working
- ✅ q_list_agents - New tool working
- ✅ q_mcp_status - New tool working

## Compatibility
- **Amazon Q CLI**: v1.13.2 and later
- **Node.js**: v18+ (unchanged)
- **MCP Protocol**: Compatible with existing MCP hosts

## Migration
No changes needed for existing MCP host configurations. The server maintains the same interface while adapting to the new CLI behavior internally.

## Future Considerations
- Monitor Amazon Q CLI updates for further changes
- Consider adding more agent-related tools as the CLI evolves
- Potential integration with native MCP support in Amazon Q CLI
