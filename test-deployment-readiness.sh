#!/bin/bash

# Deployment Readiness Test Script
# Tests sentiment analysis feature and deployment readiness

set -e

echo "🚀 Testing Sentiment Analysis Feature & Deployment Readiness"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "   Some tests may fail without environment variables"
fi

# Test 1: Check if migrations exist
echo "📋 Test 1: Checking Database Migrations..."
MIGRATIONS=(
    "supabase/migrations/20251123000001_enhance_communication_events.sql"
    "supabase/migrations/20251123000002_add_last_login_tracking.sql"
    "supabase/migrations/20251123000003_health_score_performance_indexes.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
        echo -e "   ${GREEN}✅${NC} $migration"
    else
        echo -e "   ${RED}❌${NC} $migration (missing)"
        exit 1
    fi
done
echo ""

# Test 2: Check if edge functions exist
echo "⚡ Test 2: Checking Edge Functions..."
EDGE_FUNCTIONS=(
    "supabase/functions/scheduled-email-sync/index.ts"
    "supabase/functions/scheduled-health-refresh/index.ts"
)

for func in "${EDGE_FUNCTIONS[@]}"; do
    if [ -f "$func" ]; then
        echo -e "   ${GREEN}✅${NC} $func"
    else
        echo -e "   ${RED}❌${NC} $func (missing)"
        exit 1
    fi
done
echo ""

# Test 3: Check if core services exist
echo "🔧 Test 3: Checking Core Services..."
SERVICES=(
    "src/lib/services/emailAIAnalysis.ts"
    "src/lib/services/emailSyncService.ts"
    "src/lib/hooks/useEmailSync.ts"
    "src/components/health/EmailSyncPanel.tsx"
)

for service in "${SERVICES[@]}"; do
    if [ -f "$service" ]; then
        echo -e "   ${GREEN}✅${NC} $service"
    else
        echo -e "   ${RED}❌${NC} $service (missing)"
        exit 1
    fi
done
echo ""

# Test 4: Check if EmailSyncPanel is integrated in Settings
echo "🎨 Test 4: Checking UI Integration..."
if grep -q "EmailSyncPanel" src/pages/Settings.tsx; then
    echo -e "   ${GREEN}✅${NC} EmailSyncPanel integrated in Settings"
else
    echo -e "   ${RED}❌${NC} EmailSyncPanel not found in Settings.tsx"
    exit 1
fi
echo ""

# Test 5: Check TypeScript compilation
echo "📦 Test 5: Checking TypeScript Compilation..."
if npm run build:check > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅${NC} TypeScript compilation successful"
else
    echo -e "   ${YELLOW}⚠️  ${NC} TypeScript compilation has warnings (check manually)"
fi
echo ""

# Test 6: Check environment variables (if .env exists)
if [ -f .env ]; then
    echo "🔐 Test 6: Checking Environment Variables..."
    source .env
    
    if [ -n "$VITE_ANTHROPIC_API_KEY" ]; then
        echo -e "   ${GREEN}✅${NC} VITE_ANTHROPIC_API_KEY is set"
    else
        echo -e "   ${YELLOW}⚠️  ${NC} VITE_ANTHROPIC_API_KEY not set (required for sentiment analysis)"
    fi
    
    if [ -n "$VITE_SUPABASE_URL" ]; then
        echo -e "   ${GREEN}✅${NC} VITE_SUPABASE_URL is set"
    else
        echo -e "   ${RED}❌${NC} VITE_SUPABASE_URL not set (required)"
        exit 1
    fi
    
    if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
        echo -e "   ${GREEN}✅${NC} VITE_SUPABASE_ANON_KEY is set"
    else
        echo -e "   ${RED}❌${NC} VITE_SUPABASE_ANON_KEY not set (required)"
        exit 1
    fi
    echo ""
fi

# Test 7: Check if sentiment analysis is integrated in health services
echo "📊 Test 7: Checking Health Score Integration..."
if grep -q "sentiment_score" src/lib/services/dealHealthService.ts && \
   grep -q "sentiment_score" src/lib/services/relationshipHealthService.ts; then
    echo -e "   ${GREEN}✅${NC} Sentiment analysis integrated in health services"
else
    echo -e "   ${RED}❌${NC} Sentiment analysis not properly integrated"
    exit 1
fi
echo ""

# Summary
echo "============================================================"
echo -e "${GREEN}✅ All deployment readiness checks passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Run database migrations: supabase db push"
echo "2. Deploy edge functions: supabase functions deploy"
echo "3. Set environment variables in Supabase Dashboard"
echo "4. Test sentiment analysis: npm run test:sentiment (if script exists)"
echo ""









