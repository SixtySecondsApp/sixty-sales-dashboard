#!/bin/bash

################################################################################
# CUSTOMER PROVISIONING WRAPPER
################################################################################
#
# This wrapper handles execution of the actual provisioning script
# It runs the provision-customer-v2.sh script with proper environment setup.
#
# Usage:
#   ./scripts/provision-customer.sh --id acme-corp --name "ACME Corp" --email admin@acme.com --plan pro
#
################################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/scripts"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Customer Provisioning${NC}"
echo -e "${BLUE}Project Root: ${NC}$PROJECT_ROOT"
echo ""

# Make sure we have the absolute path to the provision script
cd "$PROJECT_ROOT"

# Run the actual provisioning script
# The script requires Admin DB to be accessible at localhost:5433
bash "$SCRIPT_DIR/provision-customer-v2.sh" "$@"

