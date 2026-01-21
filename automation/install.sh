#!/bin/bash
# AI Dev Hub Automation Bot installation script
# Usage: ./install.sh <target_directory>

set -e

TARGET_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════╗"
echo "║  AI Dev Hub Automation Bot Installer  ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check that we are not already in the target directory
if [ "$SCRIPT_DIR" = "$TARGET_DIR" ]; then
    echo "❌ Error: Cannot install to the same directory"
    exit 1
fi

# Create the automation directory in the target project
AUTOMATION_DIR="$TARGET_DIR/automation"
mkdir -p "$AUTOMATION_DIR"

# Sauvegarder config/settings.json s'il existe
BACKUP_CONFIG=""
if [ -f "$AUTOMATION_DIR/config/settings.json" ]; then
    BACKUP_CONFIG="/tmp/settings-backup-$(date +%s).json"
    cp "$AUTOMATION_DIR/config/settings.json" "$BACKUP_CONFIG"
    echo "✓ Config sauvegardé: $BACKUP_CONFIG"
fi

# Supprimer tout le contenu existant
echo "→ Nettoyage de $AUTOMATION_DIR..."
find "$AUTOMATION_DIR" -mindepth 1 -delete 2>/dev/null || {
    # Fallback si find ne fonctionne pas
    rm -rf "$AUTOMATION_DIR"/* "$AUTOMATION_DIR"/.[!.]* 2>/dev/null || true
}

echo "→ Copie des fichiers vers $AUTOMATION_DIR..."

# Copy files
cp -r "$SCRIPT_DIR/lib" "$AUTOMATION_DIR/"
cp -r "$SCRIPT_DIR/config" "$AUTOMATION_DIR/"
cp "$SCRIPT_DIR"/*.sh "$AUTOMATION_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/*.ps1 "$AUTOMATION_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/*.md "$AUTOMATION_DIR/" 2>/dev/null || true

# Restaurer config/settings.json si sauvegardé
if [ -n "$BACKUP_CONFIG" ] && [ -f "$BACKUP_CONFIG" ]; then
    mkdir -p "$AUTOMATION_DIR/config"
    cp "$BACKUP_CONFIG" "$AUTOMATION_DIR/config/settings.json"
    echo "✓ Config restauré depuis la sauvegarde"
    rm -f "$BACKUP_CONFIG"  # Nettoyer le backup temporaire
elif [ -f "$AUTOMATION_DIR/config/settings.example.json" ]; then
    # Créer depuis example si pas de backup
    cp "$AUTOMATION_DIR/config/settings.example.json" "$AUTOMATION_DIR/config/settings.json"
    echo "✓ Créé config/settings.json depuis example"
fi

# Créer le dossier logs et cron.log
mkdir -p "$AUTOMATION_DIR/logs"
touch "$AUTOMATION_DIR/logs/cron.log"
echo "✓ Créé logs/cron.log"

# Make scripts executable
chmod +x "$AUTOMATION_DIR"/*.sh 2>/dev/null || true
chmod +x "$AUTOMATION_DIR/lib"/*.sh 2>/dev/null || true

echo ""
echo "✓ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. cd $AUTOMATION_DIR"
echo "  2. Edit config/settings.json with your project details"
echo "  3. Run ./test-mcp-access.sh to verify MCP connection"
echo "  4. Run ./ticket-bot.sh --test --ticket-id <ID> --dry-run"
echo ""

