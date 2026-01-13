#!/bin/bash

# =============================================================================
# DEPLOY EDGE FUNCTIONS TO STAGING
# =============================================================================
# This script deploys edge functions to the STAGING Supabase project.
# Safe to use for testing before production deployment.
#
# Usage: ./scripts/deploy-functions-staging.sh [function-name]
#
# Examples:
#   ./scripts/deploy-functions-staging.sh              # Deploy all functions
#   ./scripts/deploy-functions-staging.sh health       # Deploy specific function
#   ./scripts/deploy-functions-staging.sh --list       # List deployed functions
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration - STAGING
# =============================================================================
STAGING_PROJECT_REF="caerqjzvuerejfrdtygb"
STAGING_URL="https://${STAGING_PROJECT_REF}.supabase.co"

# =============================================================================
# Parse Arguments
# =============================================================================
FUNCTION_NAME=""
LIST_ONLY=false

for arg in "$@"; do
    case $arg in
        --list)
            LIST_ONLY=true
            shift
            ;;
        *)
            if [ -z "$FUNCTION_NAME" ] && [[ ! "$arg" =~ ^-- ]]; then
                FUNCTION_NAME="$arg"
            fi
            ;;
    esac
done

# =============================================================================
# List Functions Only
# =============================================================================
if [ "$LIST_ONLY" = true ]; then
    echo -e "${BLUE}Listing deployed functions on staging...${NC}"
    supabase functions list --project-ref "$STAGING_PROJECT_REF"
    exit 0
fi

# =============================================================================
# Deploy Functions
# =============================================================================
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}   DEPLOY EDGE FUNCTIONS (Staging)          ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "Target: ${YELLOW}STAGING${NC}"
echo -e "Project: ${YELLOW}${STAGING_PROJECT_REF}${NC}"
echo -e "URL: ${YELLOW}${STAGING_URL}${NC}"
echo ""

# Check if specific function requested
if [ -n "$FUNCTION_NAME" ]; then
    echo -e "${BLUE}Deploying function: ${YELLOW}$FUNCTION_NAME${NC}"
    echo ""

    supabase functions deploy "$FUNCTION_NAME" --project-ref "$STAGING_PROJECT_REF"

    echo ""
    echo -e "${GREEN}✅ Function $FUNCTION_NAME deployed to staging${NC}"
else
    # Count functions (excluding _shared)
    FUNC_COUNT=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v "_shared" | wc -l | tr -d ' ')

    echo -e "${BLUE}Deploying all ${YELLOW}${FUNC_COUNT}${BLUE} functions to staging...${NC}"
    echo -e "${YELLOW}This may take 10-15 minutes...${NC}"
    echo ""

    # Deploy all functions
    supabase functions deploy --project-ref "$STAGING_PROJECT_REF"

    echo ""
    echo -e "${GREEN}✅ All ${FUNC_COUNT} functions deployed to staging${NC}"
fi

# =============================================================================
# Verification
# =============================================================================
echo ""
echo -e "${BLUE}Verifying deployment...${NC}"

# Test health endpoint
echo ""
echo -e "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${STAGING_URL}/functions/v1/health" 2>/dev/null || echo "")

if [[ -n "$HEALTH_RESPONSE" ]]; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    echo -e "Response: $HEALTH_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding (may need authentication)${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   STAGING DEPLOYMENT COMPLETE!             ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Functions available at:"
echo -e "  ${YELLOW}${STAGING_URL}/functions/v1/{function-name}${NC}"
echo ""
echo -e "${BLUE}Quick verification commands:${NC}"
echo -e "  supabase functions list --project-ref $STAGING_PROJECT_REF"
echo -e "  curl ${STAGING_URL}/functions/v1/health"
echo ""
echo -e "${CYAN}Ready to deploy to production?${NC}"
echo -e "  ./scripts/deploy-functions-production.sh"
echo ""
