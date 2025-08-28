#!/bin/bash

# Fix 403 Forbidden Error for Contacts Endpoint
# This script applies the necessary database and code fixes

set -e  # Exit on any error

echo "🔧 Fixing 403 Forbidden Error for Contacts Endpoint"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Step 1: Apply RLS policy fixes to Supabase
echo "📋 Step 1: Applying RLS policy fixes..."
if command -v supabase &> /dev/null; then
    echo "   Applying database migration..."
    supabase db push --include-all
    
    # Apply our specific fix
    echo "   Applying contacts RLS policies fix..."
    supabase db reset --linked
    psql $DATABASE_URL -f fix-contacts-rls-policies.sql
else
    echo "   ⚠️  Supabase CLI not found. Please apply fix-contacts-rls-policies.sql manually"
    echo "   You can apply it via the Supabase dashboard SQL editor"
fi

# Step 2: Test the fix
echo "📋 Step 2: Testing the fix..."

# Start development server in background
echo "   Starting development server..."
npm run dev > /dev/null 2>&1 &
DEV_SERVER_PID=$!

# Wait for server to start
sleep 10

# Open debug page
echo "   Opening debug page to test the fix..."
if command -v open &> /dev/null; then
    open "http://localhost:5173/debug-contacts-403-issue.html"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173/debug-contacts-403-issue.html"
else
    echo "   Please open http://localhost:5173/debug-contacts-403-issue.html in your browser"
fi

echo ""
echo "✅ Fix Applied! Next Steps:"
echo "========================="
echo "1. Open the debug page that just opened in your browser"
echo "2. Click 'Run Full Diagnostic' to test the fix"
echo "3. Try creating a contact via the QuickAdd form"
echo ""
echo "If the 403 error persists:"
echo "- Ensure you're signed in with a valid Supabase user"
echo "- Check that the user has a profile in the profiles table"
echo "- Verify RLS policies were applied correctly"
echo ""
echo "To stop the development server, run: kill $DEV_SERVER_PID"