#!/bin/bash

# Vercel Ignore Build Step script for Landing Page
# Should exit with 1 to BUILD (proceed), 0 to IGNORE (skip)

echo "--- Vercel Build Step: FORCING BUILD ---"
echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Project: $VERCEL_PROJECT_NAME"

# Explicitly exit 1 to force build and see logs
exit 1
