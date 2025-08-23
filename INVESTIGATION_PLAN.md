# Amazon Q CLI MCP Server Investigation Plan

## Overview
This document outlines the systematic investigation needed to improve the Amazon Q CLI MCP Server based on insights from analyzing the chat-cli architecture.

## Current State
The MCP server is well-structured and MCP-compliant with the following strengths:
- ✅ Tool-based architecture (ask_q, cue_q, q_translate, q_status, fetch_chunk)
- ✅ Flexible argument handling (optional model/agent parameters)
- ✅ Basic error handling with user-friendly messages
- ✅ Streaming support via fetch_chunk tool
- ✅ Non-interactive mode for automation scenarios

## Identified Improvement Opportunities

### 1. Streaming Capabilities Investigation ✅ **COMPLETED**
**Current Issue**: `ask_q` tool doesn't support real-time streaming responses
**Desired State**: Real-time streaming chat responses like chat-cli's streaming.rs

**Investigation Results**:
- **🔴 Finding**: True streaming is NOT feasible with MCP protocol due to fundamental architectural limitations
- MCP uses request-response pattern with complete JSON messages
- No built-in streaming support in MCP SDK
- Current implementation buffers all output until process completes

**Recommended Solution**: Simulated streaming through chunked responses using `fetch_chunk` pattern
- Create progressive tool calls with cache keys
- Implement chunked CLI tool similar to existing `fetch_chunk`
- Provides perceived streaming experience within MCP constraints

**Implementation Priority**: Medium (Phase 1 implementation recommended)

### 2. Session Management Investigation ✅ **COMPLETED**
**Current Issue**: No conversation history or context persistence
**Desired State**: Conversation state management like chat-cli's conversation/ module

**Investigation Results**:
- **🟢 Finding**: Session management is HIGHLY feasible with Amazon Q CLI's native features
- Amazon Q CLI provides `--resume` flag for directory-scoped conversation persistence
- Manual session commands: `/save`, `/load`, `/compact`, `/usage`, `/clear`
- JSON-based storage in `~/.aws/amazonq/history/` with portable conversation files
- Context management with token counting and intelligent summarization

**Implementation Strategy**: Session-directory mapping approach
- Map MCP session IDs to working directories: `~/.amazon-q-mcp/sessions/{sessionId}/`
- Execute Q CLI with `--resume` flag in session-specific directories
- Leverage Amazon Q CLI's native session management for conversation persistence
- Each MCP connection gets isolated conversation history

**Implementation Status**: ✅ **COMPLETED**

### 3. Error Recovery Patterns Investigation
**Current Issue**: Basic error handling vs sophisticated error management
**Desired State**: Granular error types and recovery strategies

**Investigation Questions**:
- What are the common failure modes in Amazon Q CLI?
- How does chat-cli handle different error scenarios?
- What error recovery patterns are most effective?
- How can we provide better user guidance for errors?
- What are the retry strategies for transient failures?

**Expected Outcomes**:
- Granular error classification
- Improved error messages with actionable guidance
- Automatic retry mechanisms
- Graceful degradation strategies

### 4. Configuration Patterns Investigation
**Current Issue**: Limited configuration flexibility
**Desired State**: Profile-based configuration with hierarchical settings

**Investigation Questions**:
- How does chat-cli implement profile-based configuration?
- What configuration sources are supported (CLI args, env vars, config files)?
- How does AWS credential integration work?
- What's the configuration validation approach?
- Can we support multiple configuration contexts?

**Expected Outcomes**:
- Profile-based configuration system
- Hierarchical configuration management
- AWS credential provider integration
- Configuration validation and defaults

## Investigation Prioritization

### Priority 1: Streaming Capabilities
- **Impact**: High (direct user experience improvement)
- **Complexity**: Medium
- **Dependencies**: MCP protocol capabilities

### Priority 2: Session Management  
- **Impact**: High (enables multi-turn conversations)
- **Complexity**: High
- **Dependencies**: Streaming capabilities

### Priority 3: Error Recovery Patterns
- **Impact**: Medium (improves reliability)
- **Complexity**: Low
- **Dependencies**: None

### Priority 4: Configuration Patterns
- **Impact**: Medium (improves flexibility)
- **Complexity**: Medium
- **Dependencies**: Session management

## Next Steps

1. Complete documentation of investigation needs ✅
2. Investigate streaming capabilities (Priority 1)
3. Investigate session management (Priority 2) 
4. Investigate error recovery patterns (Priority 3)
5. Investigate configuration patterns (Priority 4)
6. Implement improvements based on findings
7. Test and validate improvements

## Success Criteria

- Streaming: Real-time response display in MCP-compatible format
- Sessions: Multi-turn conversations with persistence
- Errors: Clear, actionable error messages with recovery options
- Configuration: Flexible profile-based settings with AWS integration

## Resources Needed

- Access to Amazon Q CLI documentation and source code
- MCP protocol specification for streaming capabilities
- AWS SDK documentation for credential management
- Examples of other MCP servers with advanced features