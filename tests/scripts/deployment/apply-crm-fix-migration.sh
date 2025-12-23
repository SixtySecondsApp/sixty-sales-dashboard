#!/bin/bash

# Script to apply the comprehensive CRM structure fix migration
# This migration fixes all missing tables, columns, and functions needed for QuickAdd to work

echo "========================================="
echo "CRM Structure Fix Migration Application"
echo "========================================="
echo ""
echo "This script will apply migration: 20250902_fix_all_missing_crm_structures.sql"
echo "This migration fixes:"
echo "  - Missing activity_sync_rules table"
echo "  - Missing primary_contact_id column in deals table"
echo "  - Missing columns in activities table"
echo "  - auto_process_activity function errors"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20250902_fix_all_missing_crm_structures.sql" ]; then
    echo "Error: Migration file not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check for Supabase CLI
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI to apply migration..."
    echo ""
    
    # Apply the migration
    supabase db push --include-all
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Migration applied successfully!"
    else
        echo ""
        echo "❌ Migration failed. Please check the error messages above."
        exit 1
    fi
else
    echo "Supabase CLI not found."
    echo ""
    echo "To apply this migration manually:"
    echo "1. Go to your Supabase dashboard"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and paste the contents of:"
    echo "   supabase/migrations/20250902_fix_all_missing_crm_structures.sql"
    echo "4. Click 'Run'"
    echo ""
    echo "Or install Supabase CLI:"
    echo "  npm install -g supabase"
    echo "  supabase login"
    echo "  supabase link --project-ref your-project-ref"
    echo "  Then run this script again"
fi

echo ""
echo "========================================="
echo "Post-Migration Verification"
echo "========================================="
echo ""
echo "After applying the migration, test QuickAdd functionality:"
echo "1. Open the application"
echo "2. Click the '+' button to open QuickAdd"
echo "3. Test creating:"
echo "   - Meeting activity"
echo "   - Outbound activity"
echo "   - Proposal activity"
echo "   - Sales activity"
echo ""
echo "All activity types should now work without errors!"