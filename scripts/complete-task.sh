#!/bin/bash

# Task Completion Script
# Usage: ./scripts/complete-task.sh "Phase X.Y - Task Title" "task-id-here"

set -e

TASK_TITLE="$1"
TASK_ID="$2"
BRANCH="meetings-feature-v1"

if [ -z "$TASK_TITLE" ] || [ -z "$TASK_ID" ]; then
    echo "Usage: ./scripts/complete-task.sh \"Phase X.Y - Task Title\" \"task-id-here\""
    echo "Example: ./scripts/complete-task.sh \"Phase 1.1 - Create Onboarding Flow Controller\" \"2601491f-e81c-43d3-a888-7f37863e3e4f\""
    exit 1
fi

echo "🚀 Completing task: $TASK_TITLE"
echo "📋 Task ID: $TASK_ID"
echo "🌿 Branch: $BRANCH"
echo ""

# Check if we're on the right branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "⚠️  Warning: Current branch is '$CURRENT_BRANCH', expected '$BRANCH'"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Staging changes..."
    git add .
    
    echo "💾 Committing changes..."
    COMMIT_MSG="feat: $TASK_TITLE"
    git commit -m "$COMMIT_MSG"
    
    # Get commit hash
    COMMIT_HASH=$(git rev-parse HEAD)
    SHORT_HASH=$(git rev-parse --short HEAD)
    
    echo "✅ Committed: $SHORT_HASH"
    echo ""
    echo "📤 Pushing to remote..."
    git push origin "$BRANCH"
    
    echo ""
    echo "✅ Task completed and pushed!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Add comment to task $TASK_ID with:"
    echo "   Commit: $SHORT_HASH"
    echo "   Full hash: $COMMIT_HASH"
    echo "   Branch: $BRANCH"
    echo ""
    echo "2. Update task status to 'In Review' for testing"
    echo ""
    echo "🔗 View commit:"
    echo "   git show $SHORT_HASH"
else
    echo "⚠️  No changes to commit"
    echo "   Make sure you've saved all your work!"
fi


