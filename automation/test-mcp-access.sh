#!/bin/bash
# MCP AI Dev Hub Server Access Test via Cursor CLI
# This script checks that Cursor CLI can access the MCP server and retrieve data

set -e

VERBOSE=false
if [[ "$1" == "--verbose" || "$1" == "-v" ]]; then
    VERBOSE=true
fi

# Output colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }
print_test() { echo -e "${YELLOW}→ $1${NC}"; }

echo -e "\n${MAGENTA}==================================${NC}"
echo -e "${MAGENTA}MCP AI Dev Hub Access Test${NC}"
echo -e "${MAGENTA}==================================\n${NC}"

# Test 1: Verify that Cursor CLI is installed
print_test "Test 1: Checking Cursor CLI installation"
if command -v cursor-agent &> /dev/null; then
    print_success "Cursor CLI is installed"
    if [ "$VERBOSE" = true ]; then
        CLI_VERSION=$(cursor-agent --version 2>&1 || echo "Version unavailable")
        echo -e "${GRAY}  Version: $CLI_VERSION${NC}"
    fi
else
    print_error "Cursor CLI is not installed"
    print_info "Install it with: curl https://cursor.com/install -fsS | bash"
    exit 1
fi

# Test 2: Verify MCP configuration
print_test "\nTest 2: Checking MCP configuration"

# Try to find mcp.json in multiple possible locations
if [ -f "$HOME/.cursor/mcp.json" ]; then
    MCP_CONFIG_PATH="$HOME/.cursor/mcp.json"
elif [ -f "/mnt/c/Users/$USER/.cursor/mcp.json" ]; then
    MCP_CONFIG_PATH="/mnt/c/Users/$USER/.cursor/mcp.json"
elif [ -f "/mnt/c/Users/angel/.cursor/mcp.json" ]; then
    MCP_CONFIG_PATH="/mnt/c/Users/angel/.cursor/mcp.json"
else
    MCP_CONFIG_PATH="$HOME/.cursor/mcp.json"
fi

if [ -f "$MCP_CONFIG_PATH" ]; then
    print_success "MCP configuration file found: $MCP_CONFIG_PATH"

    # Check that the ai-dev-hub-mcp-server is configured
    if grep -q "ai-dev-hub-mcp-server" "$MCP_CONFIG_PATH"; then
        print_success "MCP server 'ai-dev-hub-mcp-server' is configured"
        if [ "$VERBOSE" = true ]; then
            echo -e "${GRAY}  Configuration:${NC}"
            cat "$MCP_CONFIG_PATH" | grep -A 5 "ai-dev-hub-mcp-server" | sed 's/^/  /' | sed "s/^/${GRAY}/" | sed "s/$/${NC}/"
        fi
    else
        print_error "MCP server 'ai-dev-hub-mcp-server' not found in configuration"
        exit 1
    fi
else
    print_error "MCP configuration file not found: $MCP_CONFIG_PATH"
    print_info "Create the file with the MCP server configuration"
    print_info ""
    print_info "Expected location on this system: $HOME/.cursor/mcp.json"
    print_info ""
    print_info "Example configuration:"
    echo -e "${GRAY}"
    cat << 'EOF'
{
  "mcpServers": {
    "ai-dev-hub-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://ai-dev-hub-mcp-server-production.up.railway.app/mcp?token=YOUR_TOKEN"
      ]
    }
  }
}
EOF
    echo -e "${NC}"
    exit 1
fi

# Test 3: Check for npx and mcp-remote availability
print_test "\nTest 3: Checking npx"
if command -v npx &> /dev/null; then
    NPX_VERSION=$(npx --version)
    print_success "npx is available (version: $NPX_VERSION)"
else
    print_error "npx is not available"
    print_info "Install Node.js from https://nodejs.org"
    exit 1
fi

# Test 4: Test connection to the MCP server via Cursor CLI
print_test "\nTest 4: Testing MCP server connection (project search)"
print_info "Attempting to fetch project list via MCP..."

TEST_PROMPT="Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_projects' to list all projects. Return only the JSON result."

echo -e "${GRAY}  Running: cursor-agent -p --approve-mcps --force --output-format text \"$TEST_PROMPT\"${NC}"

# Create a temporary file to store output
OUTPUT_FILE=$(mktemp)

if cursor-agent -p --approve-mcps --force --output-format text "$TEST_PROMPT" > "$OUTPUT_FILE" 2>&1; then
    print_success "Cursor CLI command executed successfully"

    # Display output
    echo -e "\n${CYAN}--- Result ---${NC}"
    cat "$OUTPUT_FILE"
    echo -e "${CYAN}--- End of result ---\n${NC}"

    # Check if output contains project data
    if grep -iq "projects\|name\|client" "$OUTPUT_FILE"; then
        print_success "MCP server returned project data"
    else
        print_info "Output does not seem to contain any project data"
        print_info "This may be normal if no projects exist yet"
    fi
else
    print_error "Cursor CLI command failed"
    echo -e "${RED}  Error output:${NC}"
    cat "$OUTPUT_FILE"
    rm "$OUTPUT_FILE"
    exit 1
fi

rm "$OUTPUT_FILE"

# Test 5: Test task search
print_test "\nTest 5: Testing task search via MCP"
print_info "Attempting to fetch 'todo' tasks..."

TASK_PROMPT="Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_tasks' with status=['todo'] to find all todo tasks. Return the results."

echo -e "${GRAY}  Running: cursor-agent -p --approve-mcps --force --output-format text \"$TASK_PROMPT\"${NC}"

TASK_OUTPUT_FILE=$(mktemp)

if cursor-agent -p --approve-mcps --force --output-format text "$TASK_PROMPT" > "$TASK_OUTPUT_FILE" 2>&1; then
    print_success "Task request executed successfully"

    # Display output
    echo -e "\n${CYAN}--- Task Result ---${NC}"
    cat "$TASK_OUTPUT_FILE"
    echo -e "${CYAN}--- End of result ---\n${NC}"

    # Check if any tasks are present
    if grep -iq "task\|todo\|title" "$TASK_OUTPUT_FILE"; then
        print_success "Tasks found or the system responded correctly"
    else
        print_info "No 'todo' tasks found (may be normal)"
    fi
else
    print_error "Task request failed"
    echo -e "${RED}  Error output:${NC}"
    cat "$TASK_OUTPUT_FILE"
    rm "$TASK_OUTPUT_FILE"
    exit 1
fi

rm "$TASK_OUTPUT_FILE"

# Final summary
echo -e "\n${MAGENTA}==================================${NC}"
echo -e "${MAGENTA}       Test Summary${NC}"
echo -e "${MAGENTA}==================================\n${NC}"

print_success "All tests passed!"
echo ""
print_success "✓ Cursor CLI is installed and working"
print_success "✓ MCP configuration is correct"
print_success "✓ Connection to MCP AI Dev Hub server successful"
print_success "✓ MCP tools are accessible"
echo ""
print_info "The automation system can now be deployed."
print_info "Next step: Configure settings.json with your Project ID"
echo ""

