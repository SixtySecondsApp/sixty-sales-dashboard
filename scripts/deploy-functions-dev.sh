#!/bin/bash

# =============================================================================
# DEPLOY EDGE FUNCTIONS TO DEVELOPMENT
# =============================================================================
# This script deploys all edge functions to the development Supabase project.
#
# Usage: ./scripts/deploy-functions-dev.sh [function-name]
#
# Examples:
#   ./scripts/deploy-functions-dev.sh           # Deploy all functions
#   ./scripts/deploy-functions-dev.sh health    # Deploy specific function
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
get_project_ref_from_env_file() {
    local env_file="$1"
    if [ ! -f "$env_file" ]; then
        return 1
    fi

    # Extract VITE_SUPABASE_URL and derive project ref from https://<ref>.supabase.co
    local url
    url=$(grep -E '^VITE_SUPABASE_URL=' "$env_file" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -z "$url" ]; then
        return 1
    fi

    # url might include branch refs like https://<project-ref>-<branch-id>.supabase.co
    # For edge functions deploy we need the base project ref (the first segment).
    local host
    host=$(echo "$url" | sed -E 's#^https?://##' | cut -d'/' -f1)
    local ref
    ref=$(echo "$host" | cut -d'.' -f1 | cut -d'-' -f1)

    if [ -n "$ref" ]; then
        echo "$ref"
        return 0
    fi

    return 1
}

# Determine target project ref in a safe, repeatable way:
# 1) SUPABASE_PROJECT_REF (explicit)
# 2) VITE_SUPABASE_URL (already exported in shell)
# 3) .env.local / .env (derive from VITE_SUPABASE_URL)
TARGET_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$TARGET_PROJECT_REF" ] && [ -n "$VITE_SUPABASE_URL" ]; then
    TARGET_PROJECT_REF="$(echo "$VITE_SUPABASE_URL" | sed -E 's#^https?://##' | cut -d'/' -f1 | cut -d'.' -f1 | cut -d'-' -f1)"
fi
if [ -z "$TARGET_PROJECT_REF" ]; then
    TARGET_PROJECT_REF="$(get_project_ref_from_env_file ".env.local" || true)"
fi
if [ -z "$TARGET_PROJECT_REF" ]; then
    TARGET_PROJECT_REF="$(get_project_ref_from_env_file ".env" || true)"
fi
if [ -z "$TARGET_PROJECT_REF" ]; then
    echo -e "${RED}Error: Could not determine Supabase project ref.${NC}"
    echo -e "${YELLOW}Set SUPABASE_PROJECT_REF=your-project-ref or create .env.local with VITE_SUPABASE_URL=https://<ref>.supabase.co${NC}"
    exit 1
fi

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   DEPLOY EDGE FUNCTIONS (Development)      ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "Target: ${YELLOW}${TARGET_PROJECT_REF}${NC}"
echo ""

# Check if specific function requested
if [ -n "$1" ]; then
    echo -e "${BLUE}Deploying function: $1${NC}"
    supabase functions deploy "$1" --project-ref "$TARGET_PROJECT_REF"
    echo -e "${GREEN}Function $1 deployed${NC}"
else
    # Count functions
    FUNC_COUNT=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v "_shared" | wc -l | tr -d ' ')
    echo -e "${BLUE}Deploying all ${FUNC_COUNT} functions...${NC}"
    echo -e "${YELLOW}This may take several minutes...${NC}"
    echo ""

    # Deploy all functions
    supabase functions deploy --project-ref "$TARGET_PROJECT_REF"

    echo ""
    echo -e "${GREEN}All functions deployed${NC}"
fi

# -----------------------------------------------------------------------------
# Verification
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Verifying deployment...${NC}"

# List deployed functions
supabase functions list --project-ref "$TARGET_PROJECT_REF" 2>/dev/null || echo "Could not list functions"

# Test health endpoint
echo ""
echo -e "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://${TARGET_PROJECT_REF}.supabase.co/functions/v1/health" 2>/dev/null)
if [[ "$HEALTH_RESPONSE" == *"ok"* ]] || [[ "$HEALTH_RESPONSE" == *"healthy"* ]] || [[ -n "$HEALTH_RESPONSE" ]]; then
    echo -e "${GREEN}Health endpoint responding${NC}"
    echo -e "Response: $HEALTH_RESPONSE"
else
    echo -e "${YELLOW}Health endpoint not responding (may need authentication)${NC}"
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE!                     ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Functions available at:"
echo -e "  ${YELLOW}https://${TARGET_PROJECT_REF}.supabase.co/functions/v1/{function-name}${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to set function secrets in the Supabase Dashboard${NC}"
echo -e "  Dashboard → Edge Functions → Secrets"
echo ""
