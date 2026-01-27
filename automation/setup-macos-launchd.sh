#!/bin/bash
# launchd setup script for macOS
# This script creates a launchd agent to run the bot automatically

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.ai-dev-hub.ticket-bot"
INTERVAL_SECONDS=3600  # 1 hour by default
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
BOT_SCRIPT="$SCRIPT_DIR/ticket-bot.sh"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  launchd Configuration (macOS)        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check we are on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is intended for macOS only${NC}"
    echo -e "${YELLOW}   For Linux, use cron: crontab -e${NC}"
    exit 1
fi

echo -e "${GREEN}✓ macOS system detected${NC}"

# Check that the script exists
if [ ! -f "$BOT_SCRIPT" ]; then
    echo -e "${RED}❌ Script not found: $BOT_SCRIPT${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Script found: $BOT_SCRIPT${NC}"

# Make the script executable
chmod +x "$BOT_SCRIPT"
echo -e "${GREEN}✓ Script made executable${NC}"

# Create the LaunchAgents folder if it does not exist
mkdir -p "$HOME/Library/LaunchAgents"

# Check if an agent already exists
if [ -f "$PLIST_PATH" ]; then
    echo ""
    echo -e "${YELLOW}⚠ A launchd agent named '$LABEL' already exists${NC}"
    read -p "Do you want to remove it and create a new one? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[YyOo]$ ]]; then
        # Unload the agent
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        # Remove the file
        rm -f "$PLIST_PATH"
        echo -e "${GREEN}✓ Old agent removed${NC}"
    else
        echo -e "${RED}❌ Setup cancelled${NC}"
        exit 0
    fi
fi

# Ask for the interval
echo ""
echo -e "${CYAN}Execution interval configuration${NC}"
echo "1) Every 15 minutes"
echo "2) Every 30 minutes"
echo "3) Every hour (default)"
echo "4) Every 2 hours"
echo "5) Custom"
read -p "Choose an option (1-5): " interval_choice

case $interval_choice in
    1)
        INTERVAL_SECONDS=900
        INTERVAL_TEXT="15 minutes"
        ;;
    2)
        INTERVAL_SECONDS=1800
        INTERVAL_TEXT="30 minutes"
        ;;
    3)
        INTERVAL_SECONDS=3600
        INTERVAL_TEXT="1 hour"
        ;;
    4)
        INTERVAL_SECONDS=7200
        INTERVAL_TEXT="2 hours"
        ;;
    5)
        read -p "Enter the interval in minutes: " custom_minutes
        INTERVAL_SECONDS=$((custom_minutes * 60))
        INTERVAL_TEXT="$custom_minutes minutes"
        ;;
    *)
        INTERVAL_SECONDS=3600
        INTERVAL_TEXT="1 hour"
        ;;
esac

echo -e "${GREEN}✓ Interval configured: $INTERVAL_TEXT${NC}"

# Create the plist file
echo ""
echo -e "${CYAN}Creating plist file...${NC}"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$BOT_SCRIPT</string>
        <string>--once</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
    
    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/logs/launchd-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/logs/launchd-stderr.log</string>
    
    <key>StartInterval</key>
    <integer>$INTERVAL_SECONDS</integer>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <false/>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
EOF

echo -e "${GREEN}✓ Plist file created: $PLIST_PATH${NC}"

# Load the agent
echo ""
echo -e "${CYAN}Loading launchd agent...${NC}"

if launchctl load "$PLIST_PATH"; then
    echo -e "${GREEN}✓ launchd agent loaded successfully!${NC}"
else
    echo -e "${RED}❌ Error loading the agent${NC}"
    exit 1
fi

# Show the details
echo ""
echo -e "${CYAN}Details:${NC}"
echo -e "  Label: ${LABEL}"
echo -e "  Frequency: Every ${INTERVAL_TEXT}"
echo -e "  Script: ${BOT_SCRIPT}"
echo -e "  Plist: ${PLIST_PATH}"

echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo -e "${GRAY}  Check status:        launchctl list | grep $LABEL${NC}"
echo -e "${GRAY}  Start now:           launchctl start $LABEL${NC}"
echo -e "${GRAY}  Stop:                launchctl stop $LABEL${NC}"
echo -e "${GRAY}  Unload:              launchctl unload $PLIST_PATH${NC}"
echo -e "${GRAY}  Reload:              launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH${NC}"

echo ""
echo -e "${YELLOW}📝 Logs will be available at:${NC}"
echo -e "${GRAY}   - Application: $SCRIPT_DIR/logs/ticket-bot-*.log${NC}"
echo -e "${GRAY}   - launchd stdout: $SCRIPT_DIR/logs/launchd-stdout.log${NC}"
echo -e "${GRAY}   - launchd stderr: $SCRIPT_DIR/logs/launchd-stderr.log${NC}"

# Offer to start now
echo ""
read -p "Do you want to start the agent now? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[YyOo]$ ]]; then
    if launchctl start "$LABEL"; then
        echo -e "${GREEN}✓ Agent started!${NC}"
        echo -e "${GRAY}  Check the logs in a moment${NC}"
    else
        echo -e "${YELLOW}⚠ The agent will automatically start on next user login${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
