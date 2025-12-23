#!/bin/bash

# Script to create GitHub release v2.1.5
# Run this after authenticating with: gh auth login

echo "Creating GitHub Release v2.1.5..."

# Check if authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "Please run: gh auth login"
    echo "Then run this script again"
    exit 1
fi

# Create the release
gh release create v2.1.5 \
    --title "v2.1.5 - Workflow Analytics & Real Data Testing" \
    --notes-file RELEASE_NOTES_2.1.5.md \
    --latest

if [ $? -eq 0 ]; then
    echo "✅ Release v2.1.5 created successfully!"
    echo "View at: https://github.com/SixtySecondsApp/sixty-sales-dashboard/releases/tag/v2.1.5"
else
    echo "❌ Failed to create release"
fi