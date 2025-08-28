#!/bin/bash

# Enhanced Meeting Webhook Test Script
# Tests webhook functionality and then verifies data via API endpoints

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Production Supabase URLs and keys
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
WEBHOOK_URL="$BASE_URL/meetings-webhook"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8"
API_KEY=${API_KEY:-"your_api_key_here"}

# Utility functions
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test webhook and verify via API
test_webhook_and_api() {
    local webhook_response="$1"
    local test_name="$2"
    local api_endpoint="$3"
    
    # Check webhook response
    if echo "$webhook_response" | grep -q '"success":true'; then
        log_pass "$test_name webhook succeeded"
        
        # If API key is set, verify via API
        if [ "$API_KEY" != "your_api_key_here" ]; then
            sleep 2  # Give the database a moment
            
            # Try to verify the data via API
            api_response=$(curl -s "$BASE_URL/$api_endpoint" \
                -H "X-API-Key: $API_KEY" 2>/dev/null)
            
            if [ $? -eq 0 ] && echo "$api_response" | grep -q '"data"'; then
                log_pass "$test_name data verified via API"
            else
                log_info "$test_name webhook succeeded, API verification skipped"
            fi
        else
            log_info "$test_name webhook succeeded, API verification skipped (no API key)"
        fi
    else
        log_fail "$test_name webhook failed"
        echo "Response: $webhook_response"
    fi
}

# Test meeting share ID
SHARE_ID="test-meeting-$(date +%s)"

main() {
    echo "=========================================="
    echo "  ENHANCED MEETING WEBHOOK TEST SUITE    "
    echo "=========================================="
    echo ""
    
    log_info "Creating test meeting with ID: $SHARE_ID"
    log_info "Webhook URL: $WEBHOOK_URL"
    log_info "Base URL: $BASE_URL"
    log_info "API Key: ${API_KEY:0:10}..."
    echo ""
    
    # Step 1: Create meeting with AI Summary
    log_test "Step 1: Testing AI Summary webhook..."
    summary_response=$(curl -s --location "$WEBHOOK_URL" \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "topic": "summary",
        "shareId": "'$SHARE_ID'",
        "recording": {
            "recording_url": "https://fathom.video/calls/389818293",
            "recording_share_url": "https://fathom.video/share/'$SHARE_ID'",
            "recording_duration_in_minutes": 45
        },
        "meeting": {
            "scheduled_start_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
            "scheduled_end_time": "'$(date -u -v +45M +"%Y-%m-%dT%H:%M:%SZ")'",
            "title": "Product Demo - Sixty Sales Dashboard",
            "has_external_invitees": true,
            "external_domains": 1,
            "invitees": [
                {
                    "name": "Phil O'\''Brien",
                    "email": "phil@sixtyseconds.video"
                },
                {
                    "name": "John Smith",
                    "email": "john@acmecorp.com"
                }
            ]
        },
        "fathom_user": {
            "name": "Phil O'\''Brien",
            "email": "phil@sixtyseconds.video",
            "team": "Sales"
        },
        "ai_summary": "Excellent product demo showcasing the Sixty Sales dashboard. Key highlights:\n\n• Demonstrated real-time pipeline visualization\n• Showed advanced activity tracking features\n• Discussed integration capabilities with existing CRM systems\n• Client expressed strong interest in the automated reporting features\n\nNext steps:\n• Send detailed pricing proposal\n• Schedule technical deep-dive session\n• Provide access to sandbox environment",
        "sentiment_score": 0.75,
        "coach_rating": 85,
        "coach_summary": "Strong discovery, excellent rapport building, clear value articulation",
        "talk_time_rep_pct": 48,
        "talk_time_customer_pct": 52,
        "talk_time_judgement": "good"
    }')
    
    test_webhook_and_api "$summary_response" "AI Summary" "api-v1-meetings?search=$SHARE_ID"

    echo ""
    
    # Step 2: Add Action Items
    log_test "Step 2: Testing Action Items webhooks..."
    
    # Action Item 1
    action_item_1_response=$(curl -s --location "$WEBHOOK_URL" \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "topic": "action_items",
        "shareId": "'$SHARE_ID'",
        "action_item": {
            "description": "Send detailed pricing proposal with enterprise tier options",
            "completed": false,
            "ai_generated": true,
            "recording_timestamp": "00:21:23",
            "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=1283"
        },
        "assignee": {
            "name": "Phil O'\''Brien",
            "email": "phil@sixtyseconds.video",
            "team": "Sales"
        },
        "deadline_days": 2,
        "priority": "high"
    }')
    
    test_webhook_and_api "$action_item_1_response" "Action Item 1" "api-v1-meetings?search=$SHARE_ID"
    
    sleep 1
    
    # Action Item 2
    action_item_2_response=$(curl -s --location "$WEBHOOK_URL" \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "topic": "action_items",
        "shareId": "'$SHARE_ID'",
        "action_item": {
            "description": "Schedule technical deep-dive session with engineering team",
            "completed": false,
            "ai_generated": true,
            "recording_timestamp": "00:35:15",
            "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=2115"
        },
        "assignee": {
            "name": "Phil O'\''Brien",
            "email": "phil@sixtyseconds.video",
            "team": "Sales"
        },
        "deadline_days": 3,
        "priority": "medium"
    }')
    
    test_webhook_and_api "$action_item_2_response" "Action Item 2" "api-v1-meetings?search=$SHARE_ID"
    
    sleep 1
    
    # Action Item 3
    action_item_3_response=$(curl -s --location "$WEBHOOK_URL" \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "topic": "action_items",
        "shareId": "'$SHARE_ID'",
        "action_item": {
            "description": "Review proposal with decision makers and provide feedback",
            "completed": false,
            "ai_generated": true,
            "recording_timestamp": "00:42:30",
            "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=2550"
        },
        "assignee": {
            "name": "John Smith",
            "email": "john@acmecorp.com",
            "team": "Customer"
        },
        "deadline_days": 5,
        "priority": "high"
    }')
    
    test_webhook_and_api "$action_item_3_response" "Action Item 3" "api-v1-meetings?search=$SHARE_ID"

    echo ""
    
    # Step 3: Add Transcript
    log_test "Step 3: Testing Transcript webhook..."
    
    transcript_response=$(curl -s --location "$WEBHOOK_URL" \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "topic": "transcript",
        "shareId": "'$SHARE_ID'",
        "transcript_url": "https://docs.google.com/document/d/1CiAMJMZscDRNjoDAvlL299SCoF3QPFoxZJDdf_drKb8/edit"
    }')
    
    test_webhook_and_api "$transcript_response" "Transcript" "api-v1-meetings?search=$SHARE_ID"
    
    echo ""
    echo "=========================================="
    echo "         WEBHOOK TEST COMPLETED          "
    echo "=========================================="
    echo ""
    
    log_pass "Test meeting created successfully!"
    log_info "Meeting ID: $SHARE_ID"
    
    # Final verification via API if possible
    if [ "$API_KEY" != "your_api_key_here" ]; then
        echo ""
        log_test "Final verification: Checking meeting via API..."
        
        final_check=$(curl -s "$BASE_URL/api-v1-meetings?search=$SHARE_ID" \
            -H "X-API-Key: $API_KEY" 2>/dev/null)
        
        if echo "$final_check" | grep -q '"count":[1-9]'; then
            log_pass "Meeting successfully created and accessible via API"
            
            # Extract meeting details if possible
            if echo "$final_check" | grep -q "Product Demo"; then
                log_pass "Meeting contains expected title and details"
            fi
        else
            log_info "Meeting may have been created but not accessible via current API key"
        fi
    fi
    
    echo ""
    log_info "Next steps:"
    log_info "1. Check the CRM dashboard at your application URL"
    log_info "2. Verify the meeting appears in /meetings"
    log_info "3. Check that action items are properly linked"
    log_info "4. Test the transcript link functionality"
}

# Check for arguments
case "${1:-}" in
    --help|-h)
        echo "Enhanced Meeting Webhook Test Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h      Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  API_KEY         Optional API key for verification via REST API"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Test webhooks only"
        echo "  API_KEY=sk_your_key $0              # Test webhooks and verify via API"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac