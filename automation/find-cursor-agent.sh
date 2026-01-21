#!/bin/bash
# Script pour trouver où cursor-agent est installé
# Utile pour configurer le wrapper cron

echo "Recherche de cursor-agent..."
echo ""

# Chemins communs à vérifier
PATHS_TO_CHECK=(
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

FOUND=false

# Vérifier chaque chemin
for path in "${PATHS_TO_CHECK[@]}"; do
    if [ -f "$path/cursor-agent" ] && [ -x "$path/cursor-agent" ]; then
        echo "✓ Trouvé: $path/cursor-agent"
        if [ "$FOUND" = false ]; then
            echo ""
            echo "Chemin à ajouter au PATH: $path"
            echo ""
            echo "Commande pour tester:"
            echo "  export PATH=\"\$PATH:$path\""
            echo "  cursor-agent --version"
            FOUND=true
        fi
    fi
done

# Essayer avec which si disponible
if command -v which >/dev/null 2>&1; then
    if CURSOR_PATH=$(which cursor-agent 2>/dev/null); then
        CURSOR_DIR=$(dirname "$CURSOR_PATH")
        if [ "$FOUND" = false ] || [ "$CURSOR_DIR" != "$path" ]; then
            echo "✓ Trouvé via 'which': $CURSOR_PATH"
            echo ""
            echo "Chemin à ajouter au PATH: $CURSOR_DIR"
            FOUND=true
        fi
    fi
fi

# Essayer avec command -v
if command -v cursor-agent >/dev/null 2>&1; then
    CURSOR_PATH=$(command -v cursor-agent)
    CURSOR_DIR=$(dirname "$CURSOR_PATH")
    echo "✓ Trouvé via 'command -v': $CURSOR_PATH"
    echo ""
    echo "Chemin à ajouter au PATH: $CURSOR_DIR"
    FOUND=true
fi

if [ "$FOUND" = false ]; then
    echo "✗ cursor-agent n'a pas été trouvé dans les chemins communs."
    echo ""
    echo "Essayez de l'installer avec:"
    echo "  curl https://cursor.com/install -fsS | bash"
    echo ""
    echo "Ou cherchez manuellement:"
    echo "  find / -name cursor-agent 2>/dev/null"
    exit 1
fi

echo ""
echo "Le wrapper ticket-bot-cron.sh devrait automatiquement détecter cursor-agent."
echo "Si le problème persiste, vérifiez que le chemin ci-dessus est inclus dans le PATH."

