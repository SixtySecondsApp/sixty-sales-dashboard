#!/bin/bash

# ================================================================
# Helper script to format production auth user mappings
# for use in ULTIMATE-FIX.sql
# ================================================================

echo "================================================================"
echo "Production Auth User Mapping Formatter"
echo "================================================================"
echo ""
echo "This script will help you format production auth user data"
echo "into SQL INSERT statements for ULTIMATE-FIX.sql"
echo ""

read -sp "Enter production database password: " DB_PASSWORD
echo ""
echo ""

PROD_REF="ewtuefzeogytgmsnkpmb"
PROD_DB="postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "Querying production auth users..."
echo ""

# Query production and format as INSERT statements
psql "$PROD_DB" -t -A -F"," -c "
SELECT
    'INSERT INTO prod_auth_users (email, prod_auth_id) VALUES' as header
UNION ALL
SELECT
    '(''' || email || ''', ''' || id || ''')' ||
    CASE
        WHEN ROW_NUMBER() OVER (ORDER BY email) = COUNT(*) OVER ()
        THEN ';'
        ELSE ','
    END as insert_statement
FROM auth.users
ORDER BY CASE WHEN header IS NULL THEN 1 ELSE 0 END, email;
" 2>&1

echo ""
echo "================================================================"
echo "Copy the above SQL and paste it into ULTIMATE-FIX.sql"
echo "Replace the section that says:"
echo "-- INSERT YOUR PRODUCTION AUTH USER MAPPINGS HERE"
echo "================================================================"
