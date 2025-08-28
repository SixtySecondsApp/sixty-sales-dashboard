#!/bin/bash

echo "🚀 Deploying API Edge Functions to Supabase"
echo "==========================================="
echo ""

# List of API functions to deploy
API_FUNCTIONS=(
    "api-auth"
    "api-v1-contacts"
    "api-v1-companies"
    "api-v1-deals"
    "api-v1-tasks"
    "api-v1-meetings"
    "api-v1-activities"
    "create-api-key"
    "api-proxy"
)

# Deploy each function
for func in "${API_FUNCTIONS[@]}"; do
    echo "📦 Deploying $func..."
    npx supabase functions deploy "$func" --no-verify-jwt
    
    if [ $? -eq 0 ]; then
        echo "✅ $func deployed successfully"
    else
        echo "❌ Failed to deploy $func"
    fi
    echo ""
done

echo "==========================================="
echo "✅ API deployment complete!"
echo ""
echo "You can now:"
echo "1. Navigate to http://localhost:5174/api-testing"
echo "2. Generate an API key"
echo "3. Test all CRUD operations for all entities"
echo ""
echo "API Documentation: /docs/API_DOCUMENTATION.md"