#!/bin/bash
# Wrapper script pour exécution via cron
# Ce script configure l'environnement avant d'exécuter le bot

# Détection automatique du répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || {
    echo "ERROR: Cannot change to directory: $SCRIPT_DIR" >&2
    exit 1
}

# Détecter HOME automatiquement (important pour Cursor CLI et autres outils)
export HOME="${HOME:-$(getent passwd "$(id -un)" | cut -d: -f6)}"

# Définir d'autres variables d'environnement de base
export SHELL="/bin/bash"

# Chemins communs où cursor-agent pourrait être installé
COMMON_PATHS=(
    "/usr/local/bin"
    "/usr/local/sbin"
    "/usr/bin"
    "/usr/sbin"
    "/bin"
    "/sbin"
    "$HOME/.local/bin"
    "$HOME/.cursor/bin"
    "$HOME/.npm-global/bin"
    "$HOME/bin"
    "/opt/cursor/bin"
)

# Construire le PATH avec tous les chemins communs
BASE_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
for path in "${COMMON_PATHS[@]}"; do
    if [ -d "$path" ]; then
        BASE_PATH="$BASE_PATH:$path"
    fi
done

# Essayer de trouver cursor-agent et ajouter son répertoire au PATH
CURSOR_AGENT_PATH=""
for path in "${COMMON_PATHS[@]}"; do
    if [ -f "$path/cursor-agent" ] && [ -x "$path/cursor-agent" ]; then
        CURSOR_AGENT_PATH="$path"
        break
    fi
done

# Si cursor-agent n'est pas trouvé, essayer avec 'which' (si disponible dans le PATH minimal)
if [ -z "$CURSOR_AGENT_PATH" ]; then
    # Utiliser un PATH minimal pour which
    TEMP_PATH="/usr/bin:/bin"
    if WHICH_RESULT=$(env PATH="$TEMP_PATH" which cursor-agent 2>/dev/null); then
        CURSOR_AGENT_PATH=$(dirname "$WHICH_RESULT")
    fi
fi

# Ajouter le chemin de cursor-agent au PATH s'il a été trouvé
if [ -n "$CURSOR_AGENT_PATH" ]; then
    export PATH="$BASE_PATH:$CURSOR_AGENT_PATH"
else
    # Si toujours pas trouvé, utiliser le PATH de base et espérer que cursor-agent sera trouvé
    export PATH="$BASE_PATH"
    echo "WARNING: cursor-agent not found in common paths. Using default PATH." >&2
fi

# Vérifier que cursor-agent est maintenant accessible
if ! command -v cursor-agent >/dev/null 2>&1; then
    echo "ERROR: cursor-agent is still not found in PATH after configuration." >&2
    echo "Current PATH: $PATH" >&2
    echo "Please ensure cursor-agent is installed and accessible." >&2
    exit 1
fi

# Log de démarrage (pour debug - peut être désactivé en production)
LOG_FILE="$SCRIPT_DIR/logs/cron-wrapper.log"
mkdir -p "$(dirname "$LOG_FILE")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting ticket-bot via cron wrapper" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] cursor-agent found at: $(command -v cursor-agent)" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] PATH: $PATH" >> "$LOG_FILE"

# Exécuter le bot avec tous les arguments passés
exec "$SCRIPT_DIR/ticket-bot.sh" "$@"

