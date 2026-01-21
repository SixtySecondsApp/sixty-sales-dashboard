# AI Dev Hub Ticket Automation

This system automates ticket processing using Cursor CLI and the AI Dev Hub MCP server.

## 📋 Overview

The system runs periodically (by default every hour) and:

1. **Fetches** "todo" tickets via the MCP server
2. **Creates a Git branch** for each ticket
3. **Processes the ticket** using Cursor CLI
4. **Commits and creates a Pull Request**
5. **Updates the ticket status** to "in review"

## 🚀 Installation

This bot is designed to be **copied into each project** you want to automate. The bot works within the Git repository where it's installed.

### Quick Install

**Option 1: Manual Copy**
```bash
# Copy the automation folder into your project
cp -r automation /path/to/your-project/

# Configure it for your project
cd /path/to/your-project/automation
cp config/settings.example.json config/settings.json
# Edit config/settings.json with your project details
```

**Option 2: Using Install Script**
```bash
# From this repository
./install.sh /path/to/your-project

# Or on Windows
.\install.ps1 C:\path\to\your-project
```

### Prerequisites

- **Cursor CLI** installed: `curl https://cursor.com/install -fsS | bash`
- **Node.js** (for mcp-remote)
- **Git** configured with authentication
- **GitHub CLI** (gh) for creating PRs: `gh auth login`
- Access to the AI Dev Hub MCP server (configured in `~/.cursor/mcp.json`)

### Initial Setup

After copying the bot into your project:

1. **Configure parameters**:
Edit `config/settings.json` with your project details:
```json
{
  "projectId": "your-ai-dev-hub-project-id",
  "projectName": "Your Project Name",
  "repository": {
    "owner": "YourGitHubOrg",
    "name": "your-repo-name",
    "defaultBranch": "main"
  }
}
```

2. **Test MCP access**:
```bash
# Windows
.\test-mcp-access.ps1

# macOS/Linux
./test-mcp-access.sh
```

3. **Configure periodic execution**:

#### Windows (Task Scheduler)
```powershell
# Create a scheduled task
.\setup-windows-scheduler.ps1
```

#### macOS (launchd)
```bash
# Install the launchd service
./setup-macos-launchd.sh
```

#### Linux (cron)
```bash
# Add to crontab
crontab -e
# Add: 0 * * * * /path/to/automation/ticket-bot.sh
```

## 📁 Structure

```
automation/
├── README.md                    # This file
├── test-mcp-access.ps1          # Test script (Windows)
├── test-mcp-access.sh           # Test script (macOS/Linux)
├── ticket-bot.ps1               # Main script (Windows)
├── ticket-bot.sh                # Main script (macOS/Linux)
├── setup-windows-scheduler.ps1  # Task Scheduler setup
├── setup-macos-launchd.sh       # launchd setup
├── config/
│   └── settings.json            # Configuration
├── lib/
│   ├── mcp-client.ps1           # MCP client (Windows)
│   ├── mcp-client.sh            # MCP client (macOS/Linux)
│   ├── git-operations.ps1       # Git operations (Windows)
│   ├── git-operations.sh        # Git operations (macOS/Linux)
│   ├── logger.ps1               # Logging (Windows)
│   └── logger.sh                # Logging (macOS/Linux)
└── logs/
    └── .gitkeep                 # Logs folder
```

## 🧪 Tests

### Test 1: MCP Access
```bash
# Windows
.\test-mcp-access.ps1

# macOS/Linux
./test-mcp-access.sh
```

### Test 2: Single Ticket Processing
```bash
# Windows
.\ticket-bot.ps1 -TestMode -TicketId "cm4z8b123..."

# macOS/Linux
./ticket-bot.sh --test --ticket-id "cm4z8b123..."
```

### Test 3: Full Run (without commit)
```bash
# Windows
.\ticket-bot.ps1 -DryRun

# macOS/Linux
./ticket-bot.sh --dry-run
```

## ⚙️ Configuration

File `config/settings.json`:

```json
{
  "projectId": "cm4z8b123...",
  "projectName": "AI Dev Hub",
  "intervalMinutes": 60,
  "maxTicketsPerRun": 5,
  "repository": {
    "owner": "your-org",
    "name": "ai-dev-hub",
    "defaultBranch": "main"
  },
  "git": {
    "branchPrefix": "auto/ticket-",
    "commitMessageTemplate": "feat: {title}\n\n{description}\n\nCloses #{ticketCode}"
  },
  "cli": {
    "model": "claude-sonnet-4",
    "timeout": 300,
    "maxRetries": 3
  },
  "logging": {
    "level": "info",
    "maxLogFiles": 30
  }
}
```

## 🔍 Logs

Logs are stored in `logs/` with one file per day:
- `ticket-bot-2024-11-26.log`
- Format: `[TIMESTAMP] [LEVEL] Message`

## ⚠️ Known Limitations

1. **Cursor CLI timeout**: 30 seconds per command
   - Solution: Split into several CLI calls
   
2. **Long processes not supported**
   - Solution: Monitoring and retry if needed
   
3. **Git conflict management**
   - The bot stops and notifies in case of conflict

## 🛠️ Troubleshooting

### The bot does not fetch tickets
- Check MCP access: `.\test-mcp-access.ps1`
- Check the Project ID in `settings.json`
- Check the logs in `logs/`

### Commits fail
- Check your Git configuration: `git config --list`
- Check repository permissions

### PRs are not created
- Check GitHub CLI: `gh auth status`
- Check your GitHub token permissions

## 📝 License

Same license as the AI Dev Hub project.
