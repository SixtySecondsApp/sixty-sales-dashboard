#!/bin/bash
# Script to commit and push changes to the automation bot template

set -e

cd "$(dirname "$0")"

echo "🚀 Deploying automation bot updates..."
echo ""

# Check if there are changes
if ! git diff --quiet HEAD automation/lib/mcp-client.sh 2>/dev/null; then
    echo "✅ Changes detected in mcp-client.sh"
    
    # Add changes
    git add lib/mcp-client.sh
    
    # Commit
    git commit -m "fix: use --new-session flag to prevent cursor context pollution between MCP calls"
    
    # Push
    git push
    
    echo ""
    echo "✅ Changes pushed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. On your Ubuntu server, run:"
    echo "      cd ~/projects/ai-dev-hub/automation"
    echo "      git pull"
    echo "      ./update-bot.sh ~/projects/ai-dev-hub/application"
    echo ""
    echo "   2. Test in production mode:"
    echo "      cd ~/projects/ai-dev-hub/application/automation"
    echo "      ./ticket-bot.sh"
else
    echo "ℹ️  No changes to deploy"
fi

