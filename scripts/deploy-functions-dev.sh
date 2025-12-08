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
DEV_PROJECT_ID="jczngsvpywgrlgdwzjbr"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   DEPLOY EDGE FUNCTIONS (Development)      ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "Target: ${YELLOW}${DEV_PROJECT_ID}${NC}"
echo ""

# Check if specific function requested
if [ -n "$1" ]; then
    echo -e "${BLUE}Deploying function: $1${NC}"
    supabase functions deploy "$1" --project-ref "$DEV_PROJECT_ID"
    echo -e "${GREEN}Function $1 deployed${NC}"
else
    # Count functions
    FUNC_COUNT=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v "_shared" | wc -l | tr -d ' ')
    echo -e "${BLUE}Deploying all ${FUNC_COUNT} functions...${NC}"
    echo -e "${YELLOW}This may take several minutes...${NC}"
    echo ""

    # Deploy all functions
    supabase functions deploy --project-ref "$DEV_PROJECT_ID"

    echo ""
    echo -e "${GREEN}All functions deployed${NC}"
fi

# -----------------------------------------------------------------------------
# Verification
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Verifying deployment...${NC}"

# List deployed functions
supabase functions list --project-ref "$DEV_PROJECT_ID" 2>/dev/null || echo "Could not list functions"

# Test health endpoint
echo ""
echo -e "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://${DEV_PROJECT_ID}.supabase.co/functions/v1/health" 2>/dev/null)
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
echo -e "  ${YELLOW}https://${DEV_PROJECT_ID}.supabase.co/functions/v1/{function-name}${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to set function secrets in the Supabase Dashboard${NC}"
echo -e "  Dashboard → Edge Functions → Secrets"
echo ""
