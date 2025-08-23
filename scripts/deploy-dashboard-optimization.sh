#!/bin/bash

# Dashboard Performance Optimization Deployment Script
# Version: 2.0.0
# Date: 2024-08-23

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_VERSION="v2.0.0"
ROLLBACK_VERSION="v1.0.0"
LOG_FILE="deployment_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        log "${RED}Error: Supabase CLI is not installed${NC}"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log "${RED}Error: npm is not installed${NC}"
        exit 1
    fi
    
    # Check if git is clean
    if [[ -n $(git status -s) ]]; then
        log "${YELLOW}Warning: Git working directory is not clean${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log "${GREEN}Prerequisites check passed${NC}"
}

# Function to create backup
create_backup() {
    log "${YELLOW}Creating backup...${NC}"
    
    # Create backup directory
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup current code
    git archive HEAD --format=tar.gz -o "$BACKUP_DIR/code_backup.tar.gz"
    
    # Tag current version
    git tag -a "backup-$(date +%Y%m%d_%H%M%S)" -m "Backup before dashboard optimization deployment"
    
    # Export current environment variables
    cp .env "$BACKUP_DIR/.env.backup" 2>/dev/null || true
    
    log "${GREEN}Backup created in $BACKUP_DIR${NC}"
}

# Function to deploy database changes
deploy_database() {
    log "${YELLOW}Deploying database changes...${NC}"
    
    # Run migration
    supabase db push --dry-run
    
    read -p "Database migration looks good? Deploy? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase db push
        log "${GREEN}Database migration deployed${NC}"
    else
        log "${RED}Database migration cancelled${NC}"
        exit 1
    fi
}

# Function to deploy Edge Function
deploy_edge_function() {
    log "${YELLOW}Deploying Edge Function...${NC}"
    
    # Deploy the dashboard-metrics function
    supabase functions deploy dashboard-metrics --no-verify-jwt
    
    if [ $? -eq 0 ]; then
        log "${GREEN}Edge Function deployed successfully${NC}"
    else
        log "${RED}Edge Function deployment failed${NC}"
        exit 1
    fi
}

# Function to deploy frontend with feature flag
deploy_frontend() {
    log "${YELLOW}Building and deploying frontend...${NC}"
    
    # Set initial feature flag to 0% rollout
    export REACT_APP_USE_OPTIMIZED_DASHBOARD=true
    export REACT_APP_DASHBOARD_OPT_PERCENTAGE=0
    export REACT_APP_ENABLE_PERF_MONITORING=true
    
    # Build the application
    npm run build
    
    if [ $? -eq 0 ]; then
        log "${GREEN}Frontend build successful${NC}"
    else
        log "${RED}Frontend build failed${NC}"
        exit 1
    fi
    
    # Deploy (adjust based on your deployment method)
    # npm run deploy  # Uncomment and adjust based on your deployment
    
    log "${GREEN}Frontend deployed with 0% rollout${NC}"
}

# Function to perform health check
health_check() {
    log "${YELLOW}Performing health check...${NC}"
    
    # Wait for deployment to stabilize
    sleep 10
    
    # Check API health (adjust URL as needed)
    API_URL="${VITE_SUPABASE_URL}/functions/v1/dashboard-metrics"
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$API_URL" | grep -q "200\|401"; then
        log "${GREEN}API health check passed${NC}"
    else
        log "${RED}API health check failed${NC}"
        return 1
    fi
    
    return 0
}

# Function to gradual rollout
gradual_rollout() {
    log "${YELLOW}Starting gradual rollout...${NC}"
    
    ROLLOUT_PERCENTAGES=(10 25 50 75 100)
    
    for PERCENTAGE in "${ROLLOUT_PERCENTAGES[@]}"; do
        log "${YELLOW}Rolling out to ${PERCENTAGE}% of users...${NC}"
        
        # Update environment variable (adjust based on your deployment)
        export REACT_APP_DASHBOARD_OPT_PERCENTAGE=$PERCENTAGE
        
        # Redeploy with new percentage (simplified - adjust for your setup)
        # You might want to update a config file or use a feature flag service
        
        log "${GREEN}Rolled out to ${PERCENTAGE}% of users${NC}"
        
        # Monitor for issues
        sleep 60  # Wait 1 minute between rollout stages
        
        # Check if rollback is needed
        if ! health_check; then
            log "${RED}Health check failed at ${PERCENTAGE}% rollout${NC}"
            return 1
        fi
        
        read -p "Continue rollout to next stage? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "${YELLOW}Rollout paused at ${PERCENTAGE}%${NC}"
            return 0
        fi
    done
    
    log "${GREEN}Full rollout completed successfully${NC}"
}

# Function to rollback
rollback() {
    log "${RED}Starting rollback...${NC}"
    
    # Disable feature flag immediately
    export REACT_APP_USE_OPTIMIZED_DASHBOARD=false
    export REACT_APP_DASHBOARD_OPT_PERCENTAGE=0
    
    # Rollback database changes
    log "${YELLOW}Rolling back database changes...${NC}"
    supabase db reset --version "$ROLLBACK_VERSION"
    
    # Remove Edge Function
    log "${YELLOW}Removing Edge Function...${NC}"
    supabase functions delete dashboard-metrics
    
    # Revert code changes
    log "${YELLOW}Reverting code changes...${NC}"
    git checkout "$ROLLBACK_VERSION"
    
    # Rebuild and deploy
    npm ci
    npm run build
    # npm run deploy  # Uncomment and adjust
    
    log "${GREEN}Rollback completed${NC}"
}

# Main deployment flow
main() {
    log "${GREEN}Starting Dashboard Performance Optimization Deployment${NC}"
    log "Version: $DEPLOYMENT_VERSION"
    log "Timestamp: $(date)"
    
    # Step 1: Prerequisites
    check_prerequisites
    
    # Step 2: Create backup
    create_backup
    
    # Step 3: Deploy database changes
    deploy_database
    if [ $? -ne 0 ]; then
        log "${RED}Database deployment failed, aborting${NC}"
        exit 1
    fi
    
    # Step 4: Deploy Edge Function
    deploy_edge_function
    if [ $? -ne 0 ]; then
        log "${RED}Edge Function deployment failed, starting rollback${NC}"
        rollback
        exit 1
    fi
    
    # Step 5: Deploy frontend
    deploy_frontend
    if [ $? -ne 0 ]; then
        log "${RED}Frontend deployment failed, starting rollback${NC}"
        rollback
        exit 1
    fi
    
    # Step 6: Health check
    health_check
    if [ $? -ne 0 ]; then
        log "${RED}Health check failed, starting rollback${NC}"
        rollback
        exit 1
    fi
    
    # Step 7: Gradual rollout
    gradual_rollout
    if [ $? -ne 0 ]; then
        log "${RED}Gradual rollout failed, starting rollback${NC}"
        rollback
        exit 1
    fi
    
    log "${GREEN}Deployment completed successfully!${NC}"
    log "Dashboard optimization is now live at 100% rollout"
}

# Handle script interruption
trap 'log "${RED}Deployment interrupted, consider running rollback${NC}"; exit 1' INT TERM

# Run main function
main "$@"