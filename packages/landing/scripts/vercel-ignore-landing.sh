#!/bin/bash

# Vercel Ignore Build Step script for Landing Page
# Should exit with 1 to BUILD (proceed), 0 to IGNORE (skip)

echo "--- Vercel Build Step Check ---"
echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Project: $VERCEL_PROJECT_NAME"
echo "Working Directory: $(pwd)"

# Always build on main or master
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "master" ]]; then
  echo "✅ Force building on production branch: $VERCEL_GIT_COMMIT_REF"
  exit 1
fi

# Always build on QA branches
if [[ "$VERCEL_GIT_COMMIT_REF" == QA/* ]]; then
  echo "✅ Force building on QA branch: $VERCEL_GIT_COMMIT_REF"
  exit 1
fi

# Find repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$REPO_ROOT" ]]; then
  echo "⚠️ Could not find repo root. Proceeding with build to be safe."
  exit 1
fi

# Check for changes in relevant directories
# We use paths relative to repo root
if ! git diff --quiet HEAD^ HEAD "$REPO_ROOT/packages/landing" "$REPO_ROOT/packages/shared" 2>/dev/null; then
  echo "✅ Changes detected in landing or shared packages. Proceeding."
  exit 1
else
  echo "🛑 No changes detected. Skipping build."
  exit 0
fi
