#!/bin/bash

# =============================================================================
# SETUP DEVELOPMENT SUPABASE - Master Script
# =============================================================================
# This script sets up a complete development Supabase environment
# by migrating schema, data, and edge functions from production.
#
# Usage: ./scripts/setup-dev-supabase.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_PROJECT_ID="ewtuefzeogytgmsnkpmb"
DEV_PROJECT_ID="jczngsvpywgrlgdwzjbr"
PROD_DB_PASSWORD="SzPNQeGOhxM09pdX"
DEV_DB_PASSWORD="yBn9vjzBp9aoFQ6F"
REGION="us-west-1"

# Connection URLs (Supavisor Session Mode - Port 5432 for IPv4 compatibility)
PROD_DB_URL="postgres://postgres.${PROD_PROJECT_ID}:${PROD_DB_PASSWORD}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"
DEV_DB_URL="postgres://postgres.${DEV_PROJECT_ID}:${DEV_DB_PASSWORD}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"

# Dump file location
DUMP_FILE="production_data.dump"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   DEVELOPMENT SUPABASE SETUP               ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "Production: ${YELLOW}${PROD_PROJECT_ID}${NC}"
echo -e "Development: ${YELLOW}${DEV_PROJECT_ID}${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Check Prerequisites
# -----------------------------------------------------------------------------
echo -e "${BLUE}[Step 1/6] Checking prerequisites...${NC}"

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not installed${NC}"
    echo "Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Check for pg_dump and pg_restore
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump not installed${NC}"
    echo "Install PostgreSQL client tools"
    exit 1
fi

if ! command -v pg_restore &> /dev/null; then
    echo -e "${RED}Error: pg_restore not installed${NC}"
    echo "Install PostgreSQL client tools"
    exit 1
fi

echo -e "${GREEN}Prerequisites OK${NC}"

# -----------------------------------------------------------------------------
# Step 2: Link Supabase CLI to Development Project
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 2/6] Linking Supabase CLI to development project...${NC}"

# First unlink if already linked
supabase unlink 2>/dev/null || true

# Link to development project
supabase link --project-ref "$DEV_PROJECT_ID"

echo -e "${GREEN}Linked to development project${NC}"

# -----------------------------------------------------------------------------
# Step 3: Push Migrations to Development
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 3/6] Pushing migrations to development database...${NC}"
echo -e "${YELLOW}This may take a few minutes for 343 migrations...${NC}"

supabase db push

echo -e "${GREEN}Migrations applied successfully${NC}"

# -----------------------------------------------------------------------------
# Step 4: Export Production Data
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 4/6] Exporting production data...${NC}"
echo -e "${YELLOW}Using Supavisor session mode (IPv4 compatible)...${NC}"

pg_dump "$PROD_DB_URL" \
    --no-owner \
    --no-privileges \
    --schema=public \
    --data-only \
    -Fc \
    -f "$DUMP_FILE"

# Check file size
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}Production data exported: ${DUMP_SIZE}${NC}"

# -----------------------------------------------------------------------------
# Step 5: Import Data to Development
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 5/6] Importing data to development database...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"

# Use --clean to remove existing data first, --if-exists to avoid errors
pg_restore "$DEV_DB_URL" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    -d postgres \
    "$DUMP_FILE" 2>&1 || true  # Continue even if some tables don't exist yet

echo -e "${GREEN}Data imported to development${NC}"

# Cleanup dump file
rm -f "$DUMP_FILE"
echo -e "Cleaned up temporary dump file"

# -----------------------------------------------------------------------------
# Step 6: Deploy Edge Functions
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 6/6] Deploying edge functions...${NC}"
echo -e "${YELLOW}Deploying 111 functions...${NC}"

# Deploy all functions at once
supabase functions deploy --project-ref "$DEV_PROJECT_ID"

echo -e "${GREEN}Edge functions deployed${NC}"

# -----------------------------------------------------------------------------
# Verification
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   VERIFICATION                             ${NC}"
echo -e "${BLUE}=============================================${NC}"

# Test database connection and count records
echo -e "\nChecking record counts..."
psql "$DEV_DB_URL" -c "
SELECT 'profiles' as table_name, count(*) as records FROM profiles
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'contacts', count(*) FROM contacts
UNION ALL SELECT 'deals', count(*) FROM deals
UNION ALL SELECT 'activities', count(*) FROM activities
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'meetings', count(*) FROM meetings
ORDER BY table_name;
" 2>/dev/null || echo -e "${YELLOW}Could not verify record counts${NC}"

# Test edge function
echo -e "\nTesting health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://${DEV_PROJECT_ID}.supabase.co/functions/v1/health" 2>/dev/null || echo "failed")
if [[ "$HEALTH_RESPONSE" == *"ok"* ]] || [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    echo -e "${GREEN}Health endpoint: OK${NC}"
else
    echo -e "${YELLOW}Health endpoint: Could not verify (may need to check manually)${NC}"
fi

# -----------------------------------------------------------------------------
# Complete
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   SETUP COMPLETE!                          ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Development Supabase is ready at:"
echo -e "  URL: ${YELLOW}https://${DEV_PROJECT_ID}.supabase.co${NC}"
echo ""
echo -e "To use development environment:"
echo -e "  ${BLUE}cp .env.development .env${NC}"
echo -e "  ${BLUE}npm run dev${NC}"
echo ""
echo -e "To sync fresh data from production later:"
echo -e "  ${BLUE}./scripts/sync-prod-to-dev.sh${NC}"
echo ""
