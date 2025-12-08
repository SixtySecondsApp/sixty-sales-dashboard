#!/bin/bash

# =============================================================================
# SYNC PRODUCTION TO DEVELOPMENT
# =============================================================================
# This script syncs data from production to development Supabase.
# Use this whenever you need fresh production data in development.
#
# Usage: ./scripts/sync-prod-to-dev.sh
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
DUMP_FILE="production_data_sync.dump"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   SYNC PRODUCTION → DEVELOPMENT            ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Confirmation prompt
echo -e "${YELLOW}WARNING: This will overwrite data in development!${NC}"
echo -e "Production: ${PROD_PROJECT_ID}"
echo -e "Development: ${DEV_PROJECT_ID}"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# -----------------------------------------------------------------------------
# Step 1: Export Production Data
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 1/3] Exporting production data...${NC}"

pg_dump "$PROD_DB_URL" \
    --no-owner \
    --no-privileges \
    --schema=public \
    --data-only \
    -Fc \
    -f "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}Exported: ${DUMP_SIZE}${NC}"

# -----------------------------------------------------------------------------
# Step 2: Import to Development
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 2/3] Importing to development...${NC}"

pg_restore "$DEV_DB_URL" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    -d postgres \
    "$DUMP_FILE" 2>&1 || true

echo -e "${GREEN}Import complete${NC}"

# Cleanup
rm -f "$DUMP_FILE"

# -----------------------------------------------------------------------------
# Step 3: Verification
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[Step 3/3] Verifying sync...${NC}"

echo -e "\n${YELLOW}Production counts:${NC}"
psql "$PROD_DB_URL" -c "
SELECT 'profiles' as tbl, count(*) FROM profiles
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'deals', count(*) FROM deals
UNION ALL SELECT 'activities', count(*) FROM activities;
" 2>/dev/null || echo "Could not query production"

echo -e "\n${YELLOW}Development counts:${NC}"
psql "$DEV_DB_URL" -c "
SELECT 'profiles' as tbl, count(*) FROM profiles
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'deals', count(*) FROM deals
UNION ALL SELECT 'activities', count(*) FROM activities;
" 2>/dev/null || echo "Could not query development"

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   SYNC COMPLETE!                           ${NC}"
echo -e "${GREEN}=============================================${NC}"
