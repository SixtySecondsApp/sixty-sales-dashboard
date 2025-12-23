#!/bin/bash

# Vercel Ignore Build Step script for Landing Page
# Should exit with 1 to BUILD, 0 to IGNORE

echo "Checking if we should build landing page..."
echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Project: $VERCEL_PROJECT_NAME"

# Always build on main branch
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "master" ]]; then
  echo "✅ Building on main branch"
  exit 1
fi

# Always build on QA branches
if [[ "$VERCEL_GIT_COMMIT_REF" == QA/* ]]; then
  echo "✅ Building on QA branch"
  exit 1
fi

# Otherwise, check if anything in packages/landing or packages/shared changed
# We check relative to repo root
if git diff --quiet HEAD^ HEAD packages/landing packages/shared; then
  echo "🛑 No changes in landing or shared packages. Ignoring build."
  exit 0
else
  echo "✅ Changes detected in landing or shared packages. Proceeding with build."
  exit 1
fi
