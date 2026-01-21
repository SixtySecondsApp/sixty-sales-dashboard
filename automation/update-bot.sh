#!/bin/bash
# Script pour mettre à jour le bot dans un projet cible
# Usage: ./update-bot.sh <target_project_automation_directory>

set -e

TARGET_AUTOMATION_DIR="${1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$TARGET_AUTOMATION_DIR" ]; then
    echo "Usage: $0 <target_project_automation_directory>"
    echo ""
    echo "Example:"
    echo "  $0 /path/to/your-project/automation"
    exit 1
fi

if [ ! -d "$TARGET_AUTOMATION_DIR" ]; then
    echo "❌ Error: Directory does not exist: $TARGET_AUTOMATION_DIR"
    exit 1
fi

echo "╔════════════════════════════════════════╗"
echo "║   AI Dev Hub Bot Update               ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $TARGET_AUTOMATION_DIR"
echo ""

# Backup config
CONFIG_FILE="$TARGET_AUTOMATION_DIR/config/settings.json"
BACKUP_CONFIG=""

if [ -f "$CONFIG_FILE" ]; then
    BACKUP_CONFIG="/tmp/settings-backup-$(date +%s).json"
    cp "$CONFIG_FILE" "$BACKUP_CONFIG"
    echo "✓ Config backed up to: $BACKUP_CONFIG"
fi

# Update files (excluding config)
echo "→ Updating lib files..."
cp -r "$SCRIPT_DIR/lib"/*.sh "$TARGET_AUTOMATION_DIR/lib/" 2>/dev/null || true
cp -r "$SCRIPT_DIR/lib"/*.ps1 "$TARGET_AUTOMATION_DIR/lib/" 2>/dev/null || true

echo "→ Updating scripts..."
cp "$SCRIPT_DIR"/*.sh "$TARGET_AUTOMATION_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/*.ps1 "$TARGET_AUTOMATION_DIR/" 2>/dev/null || true

echo "→ Updating documentation..."
cp "$SCRIPT_DIR/README.md" "$TARGET_AUTOMATION_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/QUICKSTART.md" "$TARGET_AUTOMATION_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/DEPLOYMENT_GUIDE.md" "$TARGET_AUTOMATION_DIR/" 2>/dev/null || true

echo "→ Updating example config..."
cp "$SCRIPT_DIR/config/settings.example.json" "$TARGET_AUTOMATION_DIR/config/" 2>/dev/null || true

# Restore config
if [ -n "$BACKUP_CONFIG" ] && [ -f "$BACKUP_CONFIG" ]; then
    cp "$BACKUP_CONFIG" "$CONFIG_FILE"
    echo "✓ Config restored"
    rm "$BACKUP_CONFIG"
fi

# Make scripts executable
chmod +x "$TARGET_AUTOMATION_DIR"/*.sh 2>/dev/null || true
chmod +x "$TARGET_AUTOMATION_DIR/lib"/*.sh 2>/dev/null || true

echo ""
echo "✓ Update complete!"
echo ""
echo "⚠️  IMPORTANT: Test before committing:"
echo "  cd $TARGET_AUTOMATION_DIR"
echo "  ./test-mcp-access.sh"
echo "  ./ticket-bot.sh --test --ticket-id <ID> --dry-run"
echo ""

