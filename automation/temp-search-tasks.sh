#!/bin/bash
# Temporary script to search for 'todo' tasks via MCP

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/logger.sh"

PROMPT="Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_tasks' with status=['todo'] to find all todo tasks. Return the results."

write_info_log "Searching for 'todo' tasks via MCP..."

# Create a temporary file for output
OUTPUT_FILE=$(mktemp)
ERROR_FILE=$(mktemp)

# Run cursor-agent
if cursor-agent -p --output-format text "$PROMPT" > "$OUTPUT_FILE" 2> "$ERROR_FILE"; then
    RESULT=$(cat "$OUTPUT_FILE")
    echo "$RESULT"
    write_info_log "Search completed successfully"
    rm -f "$OUTPUT_FILE" "$ERROR_FILE"
    exit 0
else
    ERROR=$(cat "$ERROR_FILE")
    write_error_log "Error during search: $ERROR"
    cat "$ERROR_FILE"
    rm -f "$OUTPUT_FILE" "$ERROR_FILE"
    exit 1
fi
