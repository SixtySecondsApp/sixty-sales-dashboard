#!/bin/bash

# =============================================================================
# DEPLOY EDGE FUNCTIONS TO PRODUCTION
# =============================================================================
# This script deploys edge functions to the PRODUCTION Supabase project.
# Use with caution - this affects live users!
#
# Usage: ./scripts/deploy-functions-production.sh [function-name]
#
# Examples:
#   ./scripts/deploy-functions-production.sh              # Deploy all functions
#   ./scripts/deploy-functions-production.sh health       # Deploy specific function
#   ./scripts/deploy-functions-production.sh --list       # List deployed functions
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration - PRODUCTION
# =============================================================================
PRODUCTION_PROJECT_REF="ygdpgliavpxeugaajgrb"
PRODUCTION_URL="https://${PRODUCTION_PROJECT_REF}.supabase.co"

# =============================================================================
# Safety Check
# =============================================================================
echo ""
echo -e "${RED}=============================================${NC}"
echo -e "${RED}   ⚠️  PRODUCTION DEPLOYMENT WARNING ⚠️      ${NC}"
echo -e "${RED}=============================================${NC}"
echo ""
echo -e "You are about to deploy to: ${MAGENTA}PRODUCTION${NC}"
echo -e "Project: ${YELLOW}${PRODUCTION_PROJECT_REF}${NC}"
echo -e "URL: ${YELLOW}${PRODUCTION_URL}${NC}"
echo ""

# Check for --force flag
if [[ "$*" != *"--force"* ]]; then
    read -p "Are you sure you want to deploy to PRODUCTION? (type 'yes' to confirm): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi
fi

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
        --force)
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
    echo -e "${BLUE}Listing deployed functions...${NC}"
    supabase functions list --project-ref "$PRODUCTION_PROJECT_REF"
    exit 0
fi

# =============================================================================
# Deploy Functions
# =============================================================================
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   DEPLOY EDGE FUNCTIONS (Production)       ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Check if specific function requested
if [ -n "$FUNCTION_NAME" ]; then
    echo -e "${BLUE}Deploying function: ${YELLOW}$FUNCTION_NAME${NC}"
    echo ""

    supabase functions deploy "$FUNCTION_NAME" --project-ref "$PRODUCTION_PROJECT_REF"

    echo ""
    echo -e "${GREEN}✅ Function $FUNCTION_NAME deployed to production${NC}"
else
    # Count functions (excluding _shared)
    FUNC_COUNT=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v "_shared" | wc -l | tr -d ' ')

    echo -e "${BLUE}Deploying all ${YELLOW}${FUNC_COUNT}${BLUE} functions to production...${NC}"
    echo -e "${YELLOW}This may take 10-15 minutes...${NC}"
    echo ""

    # Deploy all functions
    supabase functions deploy --project-ref "$PRODUCTION_PROJECT_REF"

    echo ""
    echo -e "${GREEN}✅ All ${FUNC_COUNT} functions deployed to production${NC}"
fi

# =============================================================================
# Verification
# =============================================================================
echo ""
echo -e "${BLUE}Verifying deployment...${NC}"

# Test health endpoint
echo ""
echo -e "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${PRODUCTION_URL}/functions/v1/health" 2>/dev/null || echo "")

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
echo -e "${GREEN}   PRODUCTION DEPLOYMENT COMPLETE!          ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Functions available at:"
echo -e "  ${YELLOW}${PRODUCTION_URL}/functions/v1/{function-name}${NC}"
echo ""
echo -e "${BLUE}Quick verification commands:${NC}"
echo -e "  supabase functions list --project-ref $PRODUCTION_PROJECT_REF"
echo -e "  curl ${PRODUCTION_URL}/functions/v1/health"
echo ""
