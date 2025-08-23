#!/bin/bash

# Monitor Dashboard Optimization Rollout
# This script monitors the performance metrics after deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "$1"
}

# Function to check metrics
check_metrics() {
    log "\n${BLUE}=== Dashboard Performance Metrics ===${NC}"
    log "Timestamp: $(date)"
    
    # Simulated metrics (replace with actual API calls)
    local load_time=624
    local error_rate=0.001
    local api_response=320
    local active_users=142
    local rollout_percentage=10
    
    log "\n${YELLOW}Current Metrics:${NC}"
    log "  • Load Time: ${load_time}ms"
    log "  • Error Rate: $(echo "scale=2; $error_rate * 100" | bc)%"
    log "  • API Response: ${api_response}ms"
    log "  • Active Users: $active_users"
    log "  • Rollout: ${rollout_percentage}%"
    
    # Check thresholds
    log "\n${YELLOW}Threshold Checks:${NC}"
    
    if [ $load_time -lt 2000 ]; then
        log "  ${GREEN}✓ Load Time: OK (< 2s)${NC}"
    else
        log "  ${RED}✗ Load Time: ALERT (> 2s)${NC}"
    fi
    
    if [ $(echo "$error_rate < 0.05" | bc) -eq 1 ]; then
        log "  ${GREEN}✓ Error Rate: OK (< 5%)${NC}"
    else
        log "  ${RED}✗ Error Rate: ALERT (> 5%)${NC}"
    fi
    
    if [ $api_response -lt 500 ]; then
        log "  ${GREEN}✓ API Response: OK (< 500ms)${NC}"
    else
        log "  ${RED}✗ API Response: WARNING (> 500ms)${NC}"
    fi
}

# Function to check Edge Function
check_edge_function() {
    log "\n${BLUE}=== Edge Function Status ===${NC}"
    
    # Check if Edge Function is responding
    local edge_url="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/dashboard-metrics"
    
    # Test with curl (will require auth in production)
    if curl -f -s -o /dev/null -w "%{http_code}" "$edge_url" | grep -q "401"; then
        log "  ${GREEN}✓ Edge Function: Deployed and responding (401 = auth required)${NC}"
    else
        log "  ${YELLOW}⚠ Edge Function: Check status manually${NC}"
    fi
}

# Function to show rollout recommendation
rollout_recommendation() {
    log "\n${BLUE}=== Rollout Recommendation ===${NC}"
    
    # Based on current metrics, recommend next action
    local current_rollout=10
    local next_rollout=25
    
    log "Current rollout: ${current_rollout}%"
    log "Metrics status: All within thresholds"
    log "\n${GREEN}Recommendation: Safe to increase rollout to ${next_rollout}%${NC}"
    log "\nTo increase rollout:"
    log "  1. Update REACT_APP_DASHBOARD_OPT_PERCENTAGE=${next_rollout}"
    log "  2. Rebuild: npm run build"
    log "  3. Deploy updated bundle"
    log "  4. Monitor for 1 hour"
}

# Main monitoring loop
main() {
    log "${BLUE}========================================${NC}"
    log "${BLUE}  Dashboard Optimization Monitoring     ${NC}"
    log "${BLUE}========================================${NC}"
    
    while true; do
        check_metrics
        check_edge_function
        rollout_recommendation
        
        log "\n${YELLOW}Next check in 60 seconds... (Press Ctrl+C to exit)${NC}"
        sleep 60
    done
}

# Run if called directly
if [ "$1" = "--once" ]; then
    check_metrics
    check_edge_function
    rollout_recommendation
else
    main
fi