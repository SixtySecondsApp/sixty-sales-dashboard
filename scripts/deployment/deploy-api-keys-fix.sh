#!/bin/bash

# Deploy API Keys Fix
# This script applies the consolidated migration and verifies the fix

set -e

echo "🚀 Deploying API Keys Database Fix..."
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20250829000000_fix_api_keys_final.sql" ]; then
    echo "❌ Migration file not found. Please run from project root directory."
    exit 1
fi

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. You'll need to apply the migration manually."
    echo "   File: supabase/migrations/20250829000000_fix_api_keys_final.sql"
    echo ""
else
    echo "1. Applying database migration..."
    
    # Check if we're connected to a project
    if ! supabase status &> /dev/null; then
        echo "⚠️  Not connected to a Supabase project. Linking to project..."
        # Note: User will need to manually link or provide project ref
        echo "   Please run: supabase link --project-ref YOUR_PROJECT_REF"
        echo "   Then run this script again."
        echo ""
    else
        echo "   Pushing migration to database..."
        supabase db push
        echo "✅ Migration applied successfully"
        echo ""
    fi
fi

echo "2. Verifying fix with Node.js script..."
if command -v node &> /dev/null; then
    node verify-api-keys-fix.js
else
    echo "⚠️  Node.js not found. Please verify manually:"
    echo "   node verify-api-keys-fix.js"
fi

echo ""
echo "3. Testing Edge Function..."
echo "   The create-api-key Edge Function has been fixed to remove the problematic RPC call."
echo "   Test it by:"
echo "   a) Going to your dashboard"
echo "   b) Navigating to API Key management"
echo "   c) Creating a new API key"
echo ""

echo "🔍 TROUBLESHOOTING:"
echo "=================="
echo "If you still encounter issues:"
echo ""
echo "1. Database Issues:"
echo "   - Ensure migration 20250829000000_fix_api_keys_final.sql is applied"
echo "   - Check Supabase dashboard > Database > Tables for api_keys table"
echo "   - Verify RLS policies are enabled"
echo ""
echo "2. Edge Function Issues:"
echo "   - Deploy the updated create-api-key function"
echo "   - Check function logs in Supabase dashboard > Edge Functions"
echo "   - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
echo ""
echo "3. Frontend Issues:"
echo "   - Clear browser cache and refresh"
echo "   - Check browser console for JavaScript errors"
echo "   - Verify API endpoint is correctly configured"
echo ""

echo "✅ Deployment script completed!"
echo "   Please test API key creation in your application."