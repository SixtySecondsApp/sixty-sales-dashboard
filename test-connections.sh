#!/bin/bash

echo "Testing connection methods..."
echo ""

read -sp "Enter production database password: " DB_PASSWORD
echo ""
echo ""

PROD_REF="ewtuefzeogytgmsnkpmb"

# Test 1: Production via pooler (should work)
echo "1. Testing production (pooler)..."
PROD_DB="postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$PROD_DB" -c "SELECT 'Production OK' as status;" 2>&1 | head -5

# Test 2: Development-v2 direct connection
echo ""
echo "2. Testing development-v2 (direct)..."
DEV_DB_DIRECT="postgresql://postgres:${DB_PASSWORD}@db.jczngsvpywgrlgdwzjbr.supabase.co:5432/postgres"
psql "$DEV_DB_DIRECT" -c "SELECT 'Dev-v2 direct OK' as status;" 2>&1 | head -5

# Test 3: Development-v2 via pooler
echo ""
echo "3. Testing development-v2 (pooler)..."
DEV_DB_POOLER="postgresql://postgres.jczngsvpywgrlgdwzjbr:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$DEV_DB_POOLER" -c "SELECT 'Dev-v2 pooler OK' as status;" 2>&1 | head -5
