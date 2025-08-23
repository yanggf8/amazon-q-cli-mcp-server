# Claude Configuration for Amazon Q CLI MCP Server

## Core Principles
- **Concise**: Eliminate redundancy, use clear statements
- **Complete**: Cover all necessary scenarios and workflows  
- **Consistent**: Uniform terminology, formatting, and structure

## Agent-First Policy

### Mandatory Agent Usage
**Default approach**: Agents first, manual work only for trivial operations.

**Always use agents for:**
- Any error/bug/performance issue → `software-troubleshooter`
- Feature development → `fullstack-engineer`
- Codebase exploration → `general-purpose`
- File analysis → `gemini-assistant`
- Multi-step tasks (>2 tool calls)

**Manual work ONLY for:**
- Single file reads with known paths
- One-line typo fixes
- Simple commands (git status, npm install)

### Agent Selection
```
Error/Bug/Performance → software-troubleshooter
Feature/Architecture → fullstack-engineer  
Search/Exploration → general-purpose
File Analysis/Research → gemini-assistant
```

### Standard Workflow: Discovery → Analysis → Implementation
```
# 1. Discovery
Task(subagent_type="general-purpose", description="Scan and categorize files")

# 2. Analysis  
Task(subagent_type="gemini-assistant", description="Analyze discovered files")

# 3. Implementation
Task(subagent_type="fullstack-engineer", description="Implement based on analysis")
```

### Tool Usage Rules
- **Before complex tasks**: Create TodoWrite list
- **Task parameters**: description (3-5 words), structured prompt, explicit subagent_type
- **Batch operations**: Multiple Task calls in single message
- **Quality target**: >80% of complex tasks use agents

## Development Workflows

### Server Management
- Never start servers automatically
- Always request user confirmation before server operations
- User handles server startup/shutdown

### TypeScript Troubleshooting
```bash
# Cache issues
npm run clear-cache && npm run dev:fresh

# Build issues  
npm run build
```

### Database Guidelines
- No constraints in document or relational databases
- Design for flexibility over rigid structure

## Git Configuration

### Branch Strategy
```bash
# Standard workflow
git pull --no-rebase
git add . && git commit -m "message" && git push

# Unrelated histories
git pull --no-rebase --allow-unrelated-histories
```

### File Management
- `.credentials.json` → gitignored (preserve local login)
- `statsig/` → gitignored (prevent session conflicts)
- Sync only configuration files across machines
- Update documentation before commits

### Cortex Embeddings
- Custom merge driver prevents corruption
- Automatic timestamp-based conflict resolution
- No manual intervention required
- Files: `.gitattributes`, `.git/json-timestamp-merge.sh`

## Documentation Standards
- Write documentation following concise/complete/consistent principles
- Never create documentation files unless explicitly requested
- Prefer editing existing files over creating new ones
- Update docs before committing changes

## Project Investigation Framework

### Amazon Q CLI MCP Server Improvement Investigation
For systematic investigation of improvements based on chat-cli architecture analysis:

**Investigation Priority Order:**
1. **Streaming Capabilities** ✅ COMPLETED
   - Finding: True streaming NOT feasible with MCP protocol
   - Solution: Simulated streaming via chunked responses using fetch_chunk pattern

2. **Session Management** 🔄 IN PROGRESS
   - Focus: Conversation history, context persistence, multi-turn conversations
   - Goal: Implement session state management like chat-cli's conversation/ module

3. **Error Recovery Patterns** ⏳ PENDING
   - Focus: Granular error types, retry strategies, user guidance
   - Goal: Sophisticated error handling approaches

4. **Configuration Patterns** ⏳ PENDING
   - Focus: Profile-based configuration, hierarchical settings, AWS integration
   - Goal: Flexible configuration management system

**Investigation Methodology:**
- Use Task tool with general-purpose agent for systematic research
- Document findings in INVESTIGATION_PLAN.md
- Update CLAUDE.md with completion status
- Implement recommendations based on findings

**Key Files:**
- `INVESTIGATION_PLAN.md` - Detailed investigation plan and findings
- `src/server.ts` - Main MCP server implementation
- `package.json` - Dependencies and configuration
- `README.md` - Project documentation

## Project-Specific Notes

### Architecture Principles
- MCP protocol compliance is mandatory
- Maintain backward compatibility with existing tools
- Prioritize user experience over complexity
- Follow AWS security best practices

### Testing Strategy
- Integration tests for MCP protocol compliance
- End-to-end tests for Amazon Q CLI integration
- Performance tests for response times
- Error scenario testing

### Deployment Considerations
- Single binary distribution preferred
- Minimal external dependencies
- Cross-platform compatibility (Linux, macOS, Windows)
- Graceful degradation for missing dependencies