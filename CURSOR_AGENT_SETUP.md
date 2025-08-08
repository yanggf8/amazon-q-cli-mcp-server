# Amazon Q CLI Integration with Cursor Agent

Since cursor-agent doesn't natively support MCP servers, we provide several integration methods to use Amazon Q capabilities with cursor-agent.

## Prerequisites

1. **Amazon Q CLI installed and working**:
   ```bash
   q --version
   q doctor
   ```

2. **Cursor Agent installed and authenticated**:
   ```bash
   cursor-agent --version
   cursor-agent status
   ```

## Integration Methods

### Method 1: Shell Tools (Recommended)

Use our pre-built shell tools that cursor-agent can execute:

#### Setup
```bash
# Add tools to your PATH
echo 'export PATH="/home/yanggf/a/qcli/cursor-tools:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Available Tools
- **`ask-q`** - Ask Amazon Q questions
- **`q-translate`** - Convert natural language to shell commands
- **`q-audit`** - Audit code for security and best practices

#### Usage in Cursor Agent
```bash
cursor-agent

# Then use the tools:
> Can you run: ask-q "What is AWS Lambda?"
> Please execute: q-translate "find all Python files modified today"
> Run this command: q-audit "const password = '123456';" javascript
```

### Method 2: Direct Q CLI Commands

Tell cursor-agent to use Amazon Q CLI directly:

```bash
cursor-agent

# Examples:
> Run: q chat --no-interactive "Explain Docker containers"
> Execute: q translate "list all running processes"
> Use Amazon Q to audit this code: q chat --no-interactive "Review this code: [your code]"
```

### Method 3: Interactive Bridge Script

Use our Node.js bridge for a more interactive experience:

```bash
# Start the bridge
node /home/yanggf/a/qcli/cursor-agent-integration.js

# Then use commands:
ask What is Kubernetes?
translate find all log files from yesterday
audit const users = []; users.push(newUser);
help
quit
```

## Example Workflows

### Code Review Workflow
```bash
cursor-agent

> I have this JavaScript code that needs review:
> 
> const users = [];
> function addUser(name) {
>   users.push({name: name, password: "default123"});
> }
> 
> Can you run: q-audit "const users = []; function addUser(name) { users.push({name: name, password: 'default123'}); }" javascript
```

### Shell Command Generation
```bash
cursor-agent

> I need to find all Python files that were modified in the last 7 days. 
> Can you run: q-translate "find all Python files modified in the last 7 days"
```

### AWS Architecture Questions
```bash
cursor-agent

> I'm designing a serverless application and need advice.
> Please run: ask-q "What are the best practices for designing a serverless application on AWS?"
```

## Advanced Integration

### Custom Cursor Agent Prompts

You can create custom prompts that automatically use our tools:

```bash
# Create a custom prompt file
cat > ~/cursor-q-prompt.txt << 'EOF'
You are a development assistant with access to Amazon Q CLI tools. 
When users ask about AWS, cloud architecture, or need code review, 
automatically suggest using these tools:

- ask-q "question" - for AWS and technical questions
- q-translate "task" - for shell command generation  
- q-audit "code" language - for code review

Always explain what the tool does before suggesting its use.
EOF

# Use with cursor-agent
cursor-agent --print < ~/cursor-q-prompt.txt
```

### Environment Setup

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Amazon Q CLI tools for cursor-agent
export PATH="/home/yanggf/a/qcli/cursor-tools:$PATH"

# Aliases for quick access
alias cq='cursor-agent'
alias ask-amazon-q='ask-q'
alias q-shell='q-translate'
alias q-review='q-audit'
```

## Troubleshooting

### Tools Not Found
```bash
# Check if tools are in PATH
which ask-q
which q-translate

# If not found, add to PATH:
export PATH="/home/yanggf/a/qcli/cursor-tools:$PATH"
```

### Amazon Q CLI Issues
```bash
# Test Amazon Q CLI directly
q doctor
q chat --no-interactive "test"

# Check AWS credentials
aws sts get-caller-identity
```

### Cursor Agent Permission Issues
```bash
# Check cursor-agent permissions
cursor-agent status

# Allow shell commands if needed
# (cursor-agent will prompt for permission)
```

## Tips for Best Results

1. **Be Specific**: When asking cursor-agent to run our tools, be specific about the command
2. **Use Quotes**: Always quote arguments that contain spaces
3. **Check Output**: Review the tool output before using suggestions
4. **Combine Tools**: Use multiple tools in sequence for complex tasks

## Example Session

```bash
$ cursor-agent

> I'm working on a Node.js API and want to review this authentication code:
> 
> function authenticate(req, res, next) {
>   const token = req.headers.authorization;
>   if (token === "admin123") {
>     next();
>   } else {
>     res.status(401).send("Unauthorized");
>   }
> }
> 
> Can you run: q-audit "function authenticate(req, res, next) { const token = req.headers.authorization; if (token === 'admin123') { next(); } else { res.status(401).send('Unauthorized'); } }" javascript

[Amazon Q provides security review...]

> Now I need a shell command to find all JavaScript files in this project.
> Please run: q-translate "find all JavaScript files in current directory and subdirectories"

[Amazon Q provides shell command...]

> Finally, I want to ask about JWT best practices.
> Run: ask-q "What are the best practices for implementing JWT authentication in Node.js?"

[Amazon Q provides JWT guidance...]
```

This integration gives you the power of Amazon Q CLI within your cursor-agent workflows!
