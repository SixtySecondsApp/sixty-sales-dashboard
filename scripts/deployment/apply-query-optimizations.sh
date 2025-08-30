#!/bin/bash

# Database connection string
DB_URL="postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"

echo "🚀 Starting query optimization deployment..."
echo ""

# Apply the entire query optimization file
echo "📊 Creating optimized views and functions..."
psql "$DB_URL" < database-optimization/02-query-optimization.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Query optimizations applied successfully!"
    echo ""
    echo "📈 Optimizations created:"
    echo "  • companies_with_stats view"
    echo "  • deals_with_relationships view"
    echo "  • contacts_with_company view"
    echo "  • owners_with_stats view"
    echo "  • dashboard_stats materialized view"
    echo "  • get_contact_deals() function"
    echo "  • get_contact_stats() function"
    echo "  • get_contact_activities() function"
    echo "  • refresh_dashboard_stats() function"
else
    echo ""
    echo "❌ Error applying query optimizations"
    exit 1
fi