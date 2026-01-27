# Quickstart Guide

This guide will help you set up the AI Dev Hub ticket automation system in just a few minutes.

## 📋 Prerequisites

### All Systems

1. **Cursor CLI** installed:
   ```bash
   curl https://cursor.com/install -fsS | bash
   ```

2. **Node.js** (for mcp-remote):
   - Download from https://nodejs.org
   - Check: `node --version`

3. **Git** configured:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```

4. **GitHub CLI** (for Pull Requests):
   ```bash
   # Windows (with winget)
   winget install GitHub.cli

   # macOS (with Homebrew)
   brew install gh

   # Linux
   # See: https://github.com/cli/cli#installation
   ```

   Then authenticate:
   ```bash
   gh auth login
   ```

5. **MCP configuration** in `~/.cursor/mcp.json` (usually already set up)

### macOS/Linux Only

6. **jq** (for parsing JSON):
   ```bash
   # macOS
   brew install jq

   # Ubuntu/Debian
   sudo apt install jq

   # Fedora
   sudo dnf install jq
   ```

7. **bc** (for calculations):
   ```bash
   # macOS
   brew install bc

   # Linux (usually pre-installed)
   sudo apt install bc
   ```

## 🚀 5-Step Installation

### Step 1: Make scripts executable (macOS/Linux only)

```bash
cd automation
chmod +x test-mcp-access.sh
chmod +x ticket-bot.sh
chmod +x setup-macos-launchd.sh
chmod +x lib/*.sh
```

### Step 2: Test MCP access

#### Windows
```powershell
cd automation
.\test-mcp-access.ps1
```

#### macOS/Linux
```bash
cd automation
./test-mcp-access.sh
```

If everything works, you should see:
```
✓ Cursor CLI is installed and working
✓ MCP configuration is correct
✓ Connection to MCP AI Dev Hub server successful
✓ MCP tools are accessible
```

### Step 3: Configure parameters

Edit `config/settings.json`:

```json
{
  "projectId": "YOUR_PROJECT_ID_HERE",
  "projectName": "AI Dev Hub",
  "intervalMinutes": 60,
  "maxTicketsPerRun": 5,
  "repository": {
    "owner": "your-organization",
    "name": "ai-dev-hub",
    "defaultBranch": "main",
    "remote": "origin"
  }
}
```

**Important:** Replace `YOUR_PROJECT_ID_HERE` with your actual project ID.

To find your Project ID:
1. Go to your AI Dev Hub application
2. Open a project
3. The ID is in the URL: `/projects/[PROJECT_ID]`

### Step 4: Test with a ticket (optional)

Create a simple "todo" ticket to test, then:

#### Windows
```powershell
.\ticket-bot.ps1 -TestMode -TicketId "cm4z8b123..." -DryRun
```

#### macOS/Linux
```bash
./ticket-bot.sh --test --ticket-id "cm4z8b123..." --dry-run
```

The `-DryRun` / `--dry-run` mode simulates everything without making real changes.

### Step 5: Set up automatic execution

#### Windows (Task Scheduler)

1. Open PowerShell **as administrator**
2. Run:
   ```powershell
   cd automation
   .\setup-windows-scheduler.ps1
   ```
3. Follow the on-screen instructions

#### macOS (launchd)

```bash
cd automation
./setup-macos-launchd.sh
```

Follow the on-screen instructions.

#### Linux (cron)

**Important:** To avoid common issues with cron (PATH, environment variables), use the wrapper script `ticket-bot-cron.sh`:

```bash
# 1. Make the wrapper executable
chmod +x ticket-bot-cron.sh

# 2. Edit crontab
crontab -e

# 3. Add this line (runs every 10 minutes)
# Replace /path/to/automation with your full path
*/10 * * * * /path/to/automation/ticket-bot-cron.sh >> /path/to/automation/logs/cron.log 2>&1

# Or to run every hour:
0 * * * * /path/to/automation/ticket-bot-cron.sh >> /path/to/automation/logs/cron.log 2>&1
```

**Note:** If you run into issues with cron, see `TROUBLESHOOTING_CRON.md` for a full troubleshooting guide.

## 🧪 Recommended Tests

### Test 1: MCP Check
```bash
# Windows
.\test-mcp-access.ps1 -Verbose

# macOS/Linux
./test-mcp-access.sh --verbose
```

### Test 2: Simulate a run
```bash
# Windows
.\ticket-bot.ps1 -Once -DryRun -Verbose

# macOS/Linux
./ticket-bot.sh --once --dry-run --verbose
```

### Test 3: Real execution of one ticket
```bash
# Windows
.\ticket-bot.ps1 -TestMode -TicketId "YOUR_TICKET_ID"

# macOS/Linux
./ticket-bot.sh --test --ticket-id "YOUR_TICKET_ID"
```

## 📊 Monitoring

### View logs

Logs are in `automation/logs/`:

```bash
# View today's logs
# Windows
Get-Content logs\ticket-bot-$(Get-Date -Format 'yyyy-MM-dd').log -Tail 50 -Wait

# macOS/Linux
tail -f logs/ticket-bot-$(date +%Y-%m-%d).log
```

### Check scheduler state

#### Windows
```powershell
Get-ScheduledTask -TaskName "AI-Dev-Hub-Ticket-Bot"
```

#### macOS
```bash
launchctl list | grep com.ai-dev-hub.ticket-bot
```

#### Linux
```bash
crontab -l
```

## 🔧 Troubleshooting

### Problem: "Cursor CLI not found"

**Solution:** Make sure Cursor CLI is in the PATH:
```bash
# Test
cursor-agent --version

# If not found, reinstall
curl https://cursor.com/install -fsS | bash
```

### Problem: "Incomplete Git configuration"

**Solution:**
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Problem: "MCP server not responding"

**Solutions:**
1. Check configuration in `~/.cursor/mcp.json`
2. Make sure your MCP token is valid
3. Test manually: `npx mcp-remote https://...`

### Problem: "PRs are not created"

**Solutions:**
1. Check GitHub CLI: `gh auth status`
2. If necessary, re-authenticate: `gh auth login`
3. Check your GitHub token permissions

### Problem: "Bot not running via cron" (Linux)

**Solutions:**
1. Check cron logs: `tail -f logs/cron.log`
2. Verify script is executable: `chmod +x ticket-bot.sh ticket-bot-cron.sh`
3. Use the wrapper script `ticket-bot-cron.sh` instead of calling `ticket-bot.sh` directly
4. Check system cron logs: `sudo grep CRON /var/log/syslog | tail -20`
5. Ensure PATH includes all required tools (bash, jq, cursor-agent, etc.)
6. **See `TROUBLESHOOTING_CRON.md` for a complete troubleshooting guide**

### Problem: "jq command not found" (macOS/Linux)

**Solution:**
```bash
# macOS
brew install jq

# Linux
sudo apt install jq  # Ubuntu/Debian
sudo dnf install jq  # Fedora
```

## 📝 Advanced Configuration

### Customize the commit message

In `config/settings.json`:
```json
{
  "git": {
    "commitMessageTemplate": "feat({ticketCode}): {title}\n\n{description}"
  }
}
```

Available variables:
- `{title}`: Ticket title
- `{description}`: Ticket description
- `{ticketCode}`: Ticket ID

### Change the AI model

```json
{
  "cli": {
    "model": "gpt-5",  // or "claude-sonnet-4", "opus-4.1", etc.
    "timeout": 300
  }
}
```

### Notifications (coming soon)

```json
{
  "notifications": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/...",
    "onError": true,
    "onSuccess": false
  }
}
```

## 🎉 You're all set!

The bot should now:
1. ✅ Run automatically at the configured interval
2. ✅ Fetch "todo" tickets
3. ✅ Create Git branches
4. ✅ Implement changes via Cursor CLI
5. ✅ Create Pull Requests
6. ✅ Update ticket statuses

**Next steps:**
- Monitor logs during the first runs
- Adjust configuration as needed
- Start with simple tickets to test

**Need help?**
- Check `README.md` for more details
- Look at logs in the `logs/` folder
- Open an issue in the AI Dev Hub project

