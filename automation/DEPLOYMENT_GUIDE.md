# Automation Bot Deployment Guide

## 🎯 Recommended Architecture

### Principle: One Bot Per Project

The automation bot should be **copied into each project** you want to automate. Why?

1. ✅ The bot creates Git branches in the repository where it lives
2. ✅ Each project has its own configuration (projectId, repository, etc.)
3. ✅ Logs and history are separated by project
4. ✅ You can have different bot versions for different projects

## 📁 Recommended Structure

```
GitHub Repositories:
├── ai-dev-hub-processing-automation         ← Bot template (this repo) 🎯
│   ├── lib/
│   ├── config/
│   │   ├── settings.example.json
│   │   └── settings.json (for testing)
│   ├── ticket-bot.sh
│   ├── install.sh
│   └── README.md
│
├── SixtySecondsApp/ai-dev-hub               ← Application
│   ├── src/
│   ├── automation/                          ← Bot copy for this project ✅
│   │   ├── config/
│   │   │   └── settings.json               (projectId: application)
│   │   └── ...
│   └── package.json
│
├── SixtySecondsApp/ai-dev-hub-mcp-server    ← MCP Server
│   ├── src/
│   ├── automation/                          ← Bot copy for this project ✅
│   │   ├── config/
│   │   │   └── settings.json               (projectId: mcp-server)
│   │   └── ...
│   └── package.json
│
└── other-org/other-project                  ← Other project
    ├── src/
    ├── automation/                          ← Bot copy for this project ✅
    │   └── ...
    └── ...
```

## 🚀 Installing the Bot in a Project

### Step 1: Copy the Bot

**Method A - Installation Script (recommended)**

```bash
# From the template repository
cd /path/to/ai-dev-hub-processing-automation
./install.sh /path/to/target-project

# Windows
.\install.ps1 C:\path\to\target-project
```

**Method B - Manual Copy**

```bash
# Copy the automation folder
cp -r automation /path/to/target-project/

# Create the configuration file
cd /path/to/target-project/automation
cp config/settings.example.json config/settings.json
```

### Step 2: Configure for Your Project

Edit `automation/config/settings.json`:

```json
{
  "projectId": "AI-DEV-HUB-PROJECT-ID",
  "projectName": "Project Name",
  "repository": {
    "owner": "GitHubOrg",
    "name": "repo-name",
    "defaultBranch": "main"
  },
  "git": {
    "branchPrefix": "auto/ticket-",
    "authorName": "AI Dev Hub Bot",
    "authorEmail": "bot@ai-dev-hub.com"
  }
}
```

### Step 3: Test

```bash
cd automation

# Test MCP access
./test-mcp-access.sh

# Test with a ticket (dry run)
./ticket-bot.sh --test --ticket-id "TICKET-ID" --dry-run
```

### Step 4: Commit to the Project

```bash
cd /path/to/target-project
git add automation/
git commit -m "Add automation bot"
git push
```

## 🔄 Updating the Bot

When you improve the bot in the template:

```bash
# In the template repository
cd ai-dev-hub-processing-automation
git add .
git commit -m "Fix: improve JSON parsing"
git push

# Update in each project
cd /path/to/project1/automation
# Copy new files (lib/, scripts)
cp -r /path/to/template/automation/lib/* ./lib/
cp /path/to/template/automation/ticket-bot.sh ./
# KEEP config/settings.json intact!

# Test
./test-mcp-access.sh

# Commit
git add .
git commit -m "Update automation bot"
git push
```

## 📝 Practical Example

### Setup for ai-dev-hub (Application)

```bash
# 1. Go to the application project
cd /path/to/SixtySecondsApp/ai-dev-hub

# 2. Copy the bot from the template
cp -r /path/to/ai-dev-hub-processing-automation/automation ./

# 3. Configure
cd automation
cp config/settings.example.json config/settings.json
nano config/settings.json  # Edit with correct values

# settings.json content:
{
  "projectId": "d3909f34-66fb-4a1d-ac99-4d9e119f1d4d",  # Project ID from AI Dev Hub
  "projectName": "AI Dev Hub Application",
  "repository": {
    "owner": "SixtySecondsApp",
    "name": "ai-dev-hub",
    "defaultBranch": "main"
  }
}

# 4. Test
./test-mcp-access.sh
./ticket-bot.sh --test --ticket-id "156f64bd-fbbb-4c10-a3ba-c3b11f4059ec" --dry-run

# 5. Commit
cd ..
git add automation/
git commit -m "Add ticket automation bot"
git push origin main
```

### Setup for mcp-server

```bash
# 1. Go to the mcp-server project
cd /path/to/SixtySecondsApp/ai-dev-hub-mcp-server

# 2. Copy the bot
cp -r /path/to/ai-dev-hub-processing-automation/automation ./

# 3. Configure with the MCP Server projectId
cd automation
cp config/settings.example.json config/settings.json
nano config/settings.json

# settings.json content:
{
  "projectId": "PROJECT-ID-FOR-MCP-SERVER",  # MCP Server project ID
  "projectName": "AI Dev Hub MCP Server",
  "repository": {
    "owner": "SixtySecondsApp",
    "name": "ai-dev-hub-mcp-server",
    "defaultBranch": "main"
  }
}

# 4. Test and commit
./test-mcp-access.sh
cd ..
git add automation/
git commit -m "Add ticket automation bot"
git push origin main
```

## ⚙️ Scheduler Configuration

On the production server, configure the scheduler **in each project**:

```bash
# For the application
cd /path/to/ai-dev-hub/automation
./setup-macos-launchd.sh  # or setup-windows-scheduler.ps1

# For the MCP server
cd /path/to/ai-dev-hub-mcp-server/automation
./setup-macos-launchd.sh  # or setup-windows-scheduler.ps1
```

## 🎯 Summary

| Item | Git Repo | Role |
|------|----------|------|
| `ai-dev-hub-processing-automation` | Template | Source of truth, improvements |
| `ai-dev-hub/automation/` | Copy | Bot for the application |
| `ai-dev-hub-mcp-server/automation/` | Copy | Bot for the MCP server |
| `other-project/automation/` | Copy | Bot for other projects |

**Advantages:**
- ✅ Each bot works in its own Git repo
- ✅ Per-project isolated configuration
- ✅ Separate logs
- ✅ Independent deployment
- ✅ Controlled updates

**The bot creates branches and PRs in the repository where it is installed!** 🎉
