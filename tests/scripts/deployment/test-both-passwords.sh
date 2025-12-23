#!/bin/bash

echo "Testing both passwords..."
echo ""

PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"
PROD_PASSWORD="SzPNQeGOhxM09pdX"

echo "Test 1: Production with PROD password..."
PROD_DB="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$PROD_DB" -c "SELECT 'Production OK' as status;" 2>&1 | head -3

echo ""
echo "Test 2: Production with DEV password..."
PROD_DB_ALT="postgresql://postgres.${PROD_REF}:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$PROD_DB_ALT" -c "SELECT 'Production OK' as status;" 2>&1 | head -3

echo ""
echo "Test 3: Dev-v2 with DEV password via pooler..."
DEV_DB="postgresql://postgres.jczngsvpywgrlgdwzjbr:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$DEV_DB" -c "SELECT 'Dev-v2 OK' as status;" 2>&1 | head -3

echo ""
echo "Test 4: Dev-v2 with PROD password via pooler..."
DEV_DB_ALT="postgresql://postgres.jczngsvpywgrlgdwzjbr:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$DEV_DB_ALT" -c "SELECT 'Dev-v2 OK' as status;" 2>&1 | head -3
