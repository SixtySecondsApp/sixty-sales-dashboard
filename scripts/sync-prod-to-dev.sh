#!/bin/bash

# Sync Production Data to Development Branch
# This script can be run manually to refresh development data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Syncing Production Data to Development Branch${NC}"

# Check for required environment variables
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo -e "${RED}❌ Error: SUPABASE_PROJECT_ID not set${NC}"
  exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Error: SUPABASE_ACCESS_TOKEN not set${NC}"
  exit 1
fi

if [ -z "$PRODUCTION_DB_URL" ]; then
  echo -e "${RED}❌ Error: PRODUCTION_DB_URL not set${NC}"
  exit 1
fi

if [ -z "$DEVELOPMENT_DB_URL" ]; then
  echo -e "${RED}❌ Error: DEVELOPMENT_DB_URL not set${NC}"
  exit 1
fi

# Check for required tools
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}❌ Error: Supabase CLI not found. Install it: https://supabase.com/docs/guides/cli${NC}"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo -e "${RED}❌ Error: pg_dump not found. Install PostgreSQL client tools.${NC}"
  exit 1
fi

# Authenticate with Supabase
echo -e "${YELLOW}🔐 Authenticating with Supabase...${NC}"
echo "$SUPABASE_ACCESS_TOKEN" | supabase login --token - || {
  echo -e "${RED}❌ Authentication failed${NC}"
  exit 1
}

# Export production data
echo -e "${YELLOW}📦 Exporting production data...${NC}"
DUMP_FILE="production_dump_$(date +%Y%m%d_%H%M%S).dump"

pg_dump "$PRODUCTION_DB_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --exclude-table=supabase_migrations.schema_migrations \
  --exclude-table=supabase_migrations.migration_history \
  --file="$DUMP_FILE" \
  --verbose

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}✅ Production data exported: $DUMP_SIZE${NC}"

# Confirm before proceeding
read -p "⚠️  This will replace all data in the development branch. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}❌ Sync cancelled${NC}"
  rm -f "$DUMP_FILE"
  exit 0
fi

# Restore to development branch
echo -e "${YELLOW}🔄 Restoring data to development branch...${NC}"

# Clear existing data (preserve migrations)
PGPASSWORD=$(echo "$DEVELOPMENT_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p') psql "$DEVELOPMENT_DB_URL" <<EOF
-- Disable triggers temporarily
SET session_replication_role = replica;

-- Drop all tables except migrations
DO \$\$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END \$\$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;
EOF

# Restore data
PGPASSWORD=$(echo "$DEVELOPMENT_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p') pg_restore \
  --dbname="$DEVELOPMENT_DB_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  "$DUMP_FILE" || {
  echo -e "${RED}❌ Restore failed${NC}"
  rm -f "$DUMP_FILE"
  exit 1
}

echo -e "${GREEN}✅ Data restored to development branch${NC}"

# Cleanup
rm -f "$DUMP_FILE"
echo -e "${GREEN}🧹 Cleanup complete${NC}"
echo -e "${GREEN}✅ Sync completed successfully!${NC}"

