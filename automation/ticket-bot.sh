#!/bin/bash
# AI Dev Hub Ticket Automation Bot
# This script automatically processes "todo" tickets using Cursor CLI

set -e

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config/settings.json"
TEST_MODE=false
TICKET_ID=""
DRY_RUN=false
ONCE=false
VERBOSE=false

# Load modules
source "$SCRIPT_DIR/lib/logger.sh"
source "$SCRIPT_DIR/lib/mcp-client.sh"
source "$SCRIPT_DIR/git-operations.sh"

# Show help/usage
show_usage() {
    cat << EOF
AI Dev Hub Ticket Automation Bot

Usage: $0 [OPTIONS]

Options:
    --config FILE        Config file (default: config/settings.json)
    --test               Test mode: process a single ticket
    --ticket-id ID       Ticket ID to process in test mode
    --dry-run            Simulate all operations without making changes
    --once               Run once instead of looping
    --verbose            Verbose mode
    -h, --help           Show this help

Examples:
    $0                                      # Normal execution in loop mode
    $0 --once                               # Run only once
    $0 --dry-run --once                     # Simulate a single run
    $0 --test --ticket-id cm4z8b123...      # Test a specific ticket

EOF
}

# Parse arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --test)
                TEST_MODE=true
                shift
                ;;
            --ticket-id)
                TICKET_ID="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --once)
                ONCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Load configuration
load_configuration() {
    if [ ! -f "$CONFIG_FILE" ]; then
        echo "Config file not found: $CONFIG_FILE"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "ERROR: jq is not installed. Install it with: brew install jq (macOS) or apt install jq (Linux)"
        exit 1
    fi

    # Validate JSON and required fields
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        echo "ERROR: The configuration file is not valid JSON"
        exit 1
    fi

    # Validate projectIds is a non-empty array
    local project_ids_count=$(jq -r '.projectIds | if type == "array" then length else 0 end' "$CONFIG_FILE")
    if [ "$project_ids_count" -eq 0 ]; then
        echo "ERROR: projectIds must be a non-empty array in settings.json"
        exit 1
    fi

    # Validate each projectId is a non-empty string
    local invalid_ids=$(jq -r '.projectIds | to_entries | map(select(.value == null or .value == "" or (.value | type) != "string")) | length' "$CONFIG_FILE")
    if [ "$invalid_ids" -gt 0 ]; then
        echo "ERROR: All projectIds must be non-empty strings"
        exit 1
    fi
}

# Process an automation job
process_job() {
    local job_json="$1"

    # Extract job details
    local job_id=$(echo "$job_json" | jq -r '.id')
    local task_json=$(echo "$job_json" | jq -r '.Task')
    
    local task_id=$(echo "$task_json" | jq -r '.id')
    local task_code=$(echo "$task_json" | jq -r '.code // empty')
    local task_title=$(echo "$task_json" | jq -r '.title')
    local task_priority=$(echo "$task_json" | jq -r '.priority // "medium"')

    write_info_log "========================================"
    write_info_log "Processing automation job: $job_id"
    write_info_log "Task: $task_title"
    write_info_log "========================================"

    local start_time=$(date +%s)

    # Load configuration parameters
    local default_branch=$(jq -r '.repository.defaultBranch' "$CONFIG_FILE")
    local remote=$(jq -r '.repository.remote' "$CONFIG_FILE")
    local branch_prefix=$(jq -r '.git.branchPrefix' "$CONFIG_FILE")
    local cli_model=$(jq -r '.cli.model' "$CONFIG_FILE")
    local cli_timeout=$(jq -r '.cli.timeout' "$CONFIG_FILE")
    local author_name=$(jq -r '.git.authorName' "$CONFIG_FILE")
    local author_email=$(jq -r '.git.authorEmail' "$CONFIG_FILE")

    # 1. Update main branch
    write_info_log "Step 1/8: Updating main branch"
    if ! update_main_branch "$default_branch" "$remote"; then
        write_error_log "Failed to update main branch"
        # Mark job as failed
        update_job_status "$job_id" "failed" "Failed to update main branch" || true
        return 1
    fi
    
    # 1.5. Mark job as processing
    write_info_log "Step 1.5/8: Marking job as processing"
    if ! update_job_status "$job_id" "processing"; then
        write_error_log "Failed to update job status to processing"
        return 1
    fi

    # 2. Create branch for the ticket
    write_info_log "Step 2/8: Creating branch"
    local branch_name
    # Use task_code if available, otherwise use task_id
    local branch_identifier="${task_code:-$task_id}"
    if ! branch_name=$(new_ticket_branch "$branch_identifier" "$branch_prefix"); then
        write_error_log "Failed to create branch"
        update_job_status "$job_id" "failed" "Failed to create branch" || true
        return 1
    fi

    # 3. Extract ticket details from the task_json we already have
    write_info_log "Step 3/8: Extracting ticket details"
    
    local task_description=$(echo "$task_json" | jq -r '.description // "No description"')
    local task_type=$(echo "$task_json" | jq -r '.type // "feature"')
    
    write_debug_log "Task type: $task_type"
    write_debug_log "Task description: ${task_description:0:100}..."

    # 4. Use Cursor CLI to implement the ticket
    write_info_log "Step 4/8: Implementation via Cursor CLI"
    
    # Clear Cursor's cache and session data to ensure fresh context
    write_debug_log "Clearing Cursor cache and session data"
    
    # Remove Cursor session cache directories (these store conversation context)
    local cursor_cache_dirs=(
        "$HOME/.cursor/cache"
        "$HOME/.cursor/.cursor-agent"
        "$HOME/.cursor/sessions"
        "$HOME/.local/share/cursor-agent/sessions"
        "/tmp/cursor-agent-*"
    )
    
    for cache_dir in "${cursor_cache_dirs[@]}"; do
        if [ -d "$cache_dir" ] || [ -L "$cache_dir" ]; then
            write_debug_log "Removing cache: $cache_dir"
            rm -rf "$cache_dir" 2>/dev/null || true
        fi
    done
    
    # Also remove any leftover temp files from previous sessions
    rm -rf /tmp/cursor-* 2>/dev/null || true
    rm -rf /tmp/tmp.* 2>/dev/null || true
    
    write_debug_log "Cache cleared successfully"

    # Add timestamp and unique context to force Cursor to treat this as a completely new task
    local current_timestamp=$(date +%s)
    local session_id="session-${current_timestamp}-${task_id:0:8}"
    
    # Create a TASK_SPEC file that Cursor MUST follow
    local task_spec_file=".CURRENT_TASK_SPEC.md"
    cat > "$task_spec_file" << EOF
# 🚨 TASK SPECIFICATION - MUST FOLLOW EXACTLY 🚨

**Session ID**: $session_id
**Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## ⚠️ CRITICAL INSTRUCTIONS

This is Task ID: **$task_id**

DO NOT work on any other task. DO NOT reference previous conversations.
ONLY implement what is described in THIS specification file.

---

## 📋 Task Details

**Task ID**: $task_id
**Task Code**: $task_code
**Task Title**: $task_title
**Priority**: $task_priority
**Type**: $task_type

## 📝 Description

$task_description

## ✅ Requirements

Implement EXACTLY what is described above. Follow these steps:

1. Read and understand the task description above
2. Identify the specific files that need to be modified
3. Make the necessary code changes
4. Ensure all changes are complete and functional
5. Follow best practices and maintain code quality

## 🚫 What NOT to Do

- Do NOT work on health status updates
- Do NOT work on project metrics
- Do NOT work on unrelated features
- Do NOT reference previous tasks or conversations
- ONLY focus on the task described in "Description" section above

## ✓ Verification

After implementation, verify that:
- The changes match the task description
- No unrelated files were modified
- The code follows project standards
EOF

    write_debug_log "Task specification file created: $task_spec_file"
    
    local implementation_prompt="Read the file $task_spec_file and implement EXACTLY what is described in it.

This is Task ID: $task_id - \"$task_title\"

CRITICAL: Follow ONLY the specifications in $task_spec_file. Do NOT work on anything else."

    if [ "$DRY_RUN" = true ]; then
        write_info_log "[DRY RUN] Simulating implementation via Cursor CLI"
        echo "Prompt to be sent:"
        echo "$implementation_prompt"
    else
        # Set environment variables to force Cursor to start fresh
        export CURSOR_FORCE_NEW_SESSION=1
        export CURSOR_CLEAR_HISTORY=1
        export CURSOR_SESSION_ID="$session_id"
        
        write_debug_log "Starting Cursor CLI with session: $session_id"
        
        if ! invoke_cursor_cli "$implementation_prompt" "$cli_model" "text" 3 "$cli_timeout" > /dev/null; then
            write_error_log "Implementation failed"
            
            # Mark job as failed
            update_job_status "$job_id" "failed" "Implementation via Cursor CLI failed" || true
            
            reset_to_main_branch "$default_branch"
            
            # Clean up environment variables
            unset CURSOR_FORCE_NEW_SESSION
            unset CURSOR_CLEAR_HISTORY
            unset CURSOR_SESSION_ID
            
            return 1
        fi
        
        # Clean up environment variables
        unset CURSOR_FORCE_NEW_SESSION
        unset CURSOR_CLEAR_HISTORY
        unset CURSOR_SESSION_ID

        write_info_log "Implementation completed"
        
        # Clean up task specification file
        if [ -f "$task_spec_file" ]; then
            rm -f "$task_spec_file"
            write_debug_log "Task specification file removed"
        fi
        
        # Verify that changes were actually made
        if ! git diff --quiet HEAD 2>/dev/null; then
            write_info_log "Changes detected in working directory"
            
            # Log which files were modified
            local modified_files=$(git diff --name-only HEAD 2>/dev/null | head -5)
            write_debug_log "Modified files: $modified_files"
            
            # Add the task spec file to gitignore if changes were made
            if ! grep -q "^\.CURRENT_TASK_SPEC\.md$" .gitignore 2>/dev/null; then
                echo ".CURRENT_TASK_SPEC.md" >> .gitignore
                write_debug_log "Added task spec file to .gitignore"
            fi
        else
            write_warn_log "No changes detected after implementation"
            write_warn_log "This might indicate that the AI didn't make any changes, or worked on the wrong task"
        fi
    fi

    # 5. Commit changes
    write_info_log "Step 5/8: Committing changes"

    local commit_template=$(jq -r '.git.commitMessageTemplate' "$CONFIG_FILE")
    # Use | as delimiter instead of / to avoid issues with slashes in task title
    # Use task_code if available for commit message, otherwise use task_id
    local ticket_code_for_commit="${task_code:-$task_id}"
    local commit_message=$(echo "$commit_template" | sed "s|{title}|$task_title|g" | sed "s|{ticketCode}|$ticket_code_for_commit|g")

    if [ "$DRY_RUN" = true ]; then
        write_info_log "[DRY RUN] Simulating commit"
        echo "Commit message:"
        echo "$commit_message"
    else
        if ! save_changes "$commit_message" "$author_name" "$author_email"; then
            write_error_log "Commit failed"
            update_job_status "$job_id" "failed" "Failed to commit changes" || true
            reset_to_main_branch "$default_branch"
            return 1
        fi
    fi

    # 6. Push and create Pull Request
    write_info_log "Step 6/8: Push and create Pull Request"

    if [ "$DRY_RUN" = true ]; then
        write_info_log "[DRY RUN] Simulating push and PR creation"
    else
        if ! push_branch "$branch_name" "$remote"; then
            write_error_log "Push failed"
            update_job_status "$job_id" "failed" "Failed to push branch" || true
            reset_to_main_branch "$default_branch"
            return 1
        fi

        local pr_title="✨ $task_title"
        local pr_body="## Description
$task_description

## Type
$task_type

## Priority
$task_priority

---
Closes #$task_id
🤖 Automatically generated by the automation bot"
        
        local pr_url
        if pr_url=$(new_pull_request "$pr_title" "$pr_body" "$default_branch"); then
            write_info_log "Pull Request created: $pr_url"

            # 6.5. Save PR details in the automation job
            write_info_log "Step 6.5/8: Saving PR details in automation job"
            
            # Extract PR number from URL if possible
            local pr_number=""
            if [[ "$pr_url" =~ /pull/([0-9]+) ]]; then
                pr_number="${BASH_REMATCH[1]}"
            fi
            
            if ! update_job_pr "$job_id" "$pr_url" "$pr_number" "$branch_name"; then
                write_warn_log "Unable to save PR details in job"
            fi

            # 6.6. Calculate and save git statistics
            write_info_log "Step 6.6/8: Calculating git statistics"
            
            if [ "$DRY_RUN" = true ]; then
                write_info_log "[DRY RUN] Simulating git stats calculation"
                local files_changed=0
                local lines_added=0
                local lines_removed=0
            else
                local git_stats
                if git_stats=$(get_git_stats "$branch_name" "$default_branch"); then
                    IFS='|' read -r files_changed lines_added lines_removed <<< "$git_stats"
                    write_info_log "Git stats: $files_changed files, +$lines_added/-$lines_removed lines"
                else
                    write_warn_log "Could not calculate git stats"
                    files_changed=0
                    lines_added=0
                    lines_removed=0
                fi
                
                # Save stats to job (will be implemented after API route is created)
                if [ "$files_changed" -gt 0 ] || [ "$lines_added" -gt 0 ] || [ "$lines_removed" -gt 0 ]; then
                    if ! update_job_stats "$job_id" "$files_changed" "$lines_added" "$lines_removed"; then
                        write_warn_log "Unable to save git statistics in job"
                    fi
                fi
            fi

            # Add comment to ticket with PR link
            local comment="🤖 Pull Request automatically created: $pr_url"
            add_task_comment "$task_id" "$comment" || true
        else
            write_warn_log "The PR could not be created, but the code was pushed"
            # Still mark as completed even without PR
        fi
    fi

    # 7. Mark job as completed (this will auto-update task status to "In Review")
    write_info_log "Step 7/8: Marking job as completed"

    if [ "$DRY_RUN" = true ]; then
        write_info_log "[DRY RUN] Simulating job completion"
    else
        if ! update_job_status "$job_id" "completed"; then
            write_warn_log "Could not update job status to completed"
        else
            write_info_log "Job completed - Task automatically updated to 'In Review'"
        fi
    fi

    # Return to main branch
    update_main_branch "$default_branch" "$remote" > /dev/null || true

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_minutes=$(echo "scale=2; $duration / 60" | bc)

    write_info_log "Automation job processed successfully in $duration_minutes minutes"

    return 0
}

# Main loop
start_bot() {
    local project_ids_json=$(jq -c '.projectIds' "$CONFIG_FILE")
    local project_ids_count=$(jq -r '.projectIds | length' "$CONFIG_FILE")
    local project_name=$(jq -r '.projectName' "$CONFIG_FILE")
    local interval_minutes=$(jq -r '.intervalMinutes' "$CONFIG_FILE")
    local max_tickets=$(jq -r '.maxTicketsPerRun' "$CONFIG_FILE")

    write_info_log "Starting AI Dev Hub ticket automation bot"
    write_info_log "Project: $project_name ($project_ids_count project(s))"
    write_info_log "Project IDs: $project_ids_json"
    write_info_log "Interval: $interval_minutes minutes"
    write_info_log "Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'PRODUCTION')"

    # Preliminary checks
    write_info_log "Performing preliminary checks..."

    if ! test_git_configuration; then
        write_error_log "Invalid Git configuration"
        exit 1
    fi

    if ! test_github_cli; then
        write_warn_log "GitHub CLI not configured - PRs will not be created automatically"
    fi

    write_info_log "All checks passed"

    while true; do
        local iteration_start=$(date +%s)
        write_info_log ""
        write_info_log "========================================"
        write_info_log "New iteration: $(date '+%Y-%m-%d %H:%M:%S')"
        write_info_log "========================================"

        # Fetch pending jobs from all projects
        write_info_log "Searching for pending automation jobs across $project_ids_count project(s)..."
        local all_jobs
        if all_jobs=$(get_all_pending_jobs "$project_ids_json"); then
            local jobs_count=$(echo "$all_jobs" | jq 'length')
            
            if [ "$jobs_count" -eq 0 ]; then
                write_info_log "No pending automation jobs found in any project"
            else
                write_info_log "Found $jobs_count pending job(s) across all projects"
                
                # Select the highest priority job
                local job_json
                job_json=$(select_highest_priority_job "$all_jobs")
                
                if [ "$job_json" = "null" ] || [ -z "$job_json" ]; then
                    write_info_log "No job selected (unexpected)"
                else
                    # Extract job and task info for logging
                    local job_id=$(echo "$job_json" | jq -r '.id // "Unknown"')
                    local task_title=$(echo "$job_json" | jq -r '.Task.title // "Unknown"')
                    local task_priority=$(echo "$job_json" | jq -r '.Task.priority // "unknown"')
                    local source_project=$(echo "$job_json" | jq -r '.sourceProjectId // "Unknown"')
                    
                    write_info_log "Selected job: $job_id (priority: $task_priority)"
                    write_info_log "Task: $task_title"
                    write_info_log "Source project: $source_project"
                    
                    # Process the job
                    if process_job "$job_json"; then
                        write_info_log "Automation job processed successfully"
                    else
                        write_error_log "Automation job processing failed"
                    fi
                fi
            fi
        else
            write_error_log "Error while fetching pending jobs from projects"
        fi

        # Clean old logs
        local max_log_files=$(jq -r '.logging.maxLogFiles' "$CONFIG_FILE")
        clear_old_logs "$max_log_files"

        # Wait before next iteration
        if [ "$ONCE" = true ]; then
            break
        fi

        local next_run=$((iteration_start + interval_minutes * 60))
        local current_time=$(date +%s)
        local wait_seconds=$((next_run - current_time))

        if [ $wait_seconds -gt 0 ]; then
            local wait_minutes=$(echo "scale=1; $wait_seconds / 60" | bc)
            write_info_log "Next run at: $(date -d "@$next_run" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r $next_run '+%Y-%m-%d %H:%M:%S')"
            write_info_log "Waiting $wait_minutes minutes..."
            sleep "$wait_seconds"
        fi
    done

    write_info_log "Bot stopped"
}

# Main entry point
main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║       AI Dev Hub Automation Bot       ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    # Parse arguments
    parse_arguments "$@"

    # Load configuration
    load_configuration

    # Initialize logger
    local log_level
    if [ "$VERBOSE" = true ]; then
        log_level="DEBUG"
    else
        log_level=$(jq -r '.logging.level' "$CONFIG_FILE")
    fi

    local log_to_console=$(jq -r '.logging.logToConsole' "$CONFIG_FILE")
    initialize_logger "$SCRIPT_DIR/logs" "$log_level" "$log_to_console"

    # Test mode: process a single ticket
    # If TICKET_ID is provided (even without --test), activate TEST_MODE
    if [ -n "$TICKET_ID" ]; then
        TEST_MODE=true
        write_info_log "TEST MODE: Processing specific ticket $TICKET_ID"
    fi

    if [ "$TEST_MODE" = true ]; then
        if [ -z "$TICKET_ID" ]; then
            echo "Test mode requires --ticket-id"
            exit 1
        fi

        # Load configuration
        local cli_model=$(jq -r '.cli.model' "$CONFIG_FILE")
        local cli_timeout=$(jq -r '.cli.timeout' "$CONFIG_FILE")

        # Fetch the specific task directly using get_task MCP tool
        write_info_log "Fetching ticket $TICKET_ID directly..."
        
        local prompt="Use the MCP tool 'mcp_ai-dev-hub-mcp-server_get_task' with taskId: \"$TICKET_ID\" and outputFormat: \"json\".
Return ONLY the exact raw JSON object returned by the tool, without any markdown formatting, code fences, or additional text."
        
        local task_json
        if ! task_json=$(invoke_cursor_cli "$prompt" "$cli_model" "json" 3 "$cli_timeout"); then
            write_error_log "Failed to fetch ticket $TICKET_ID"
            exit 1
        fi
        
        # Extract JSON from cursor-agent wrapper
        write_debug_log "Extracting task data from response..."
        write_debug_log "Raw response (first 1000 chars): ${task_json:0:1000}"
        
        # Extract the result field from Cursor's JSON wrapper
        local result=$(echo "$task_json" | jq -r '.result // empty' 2>/dev/null)
        
        if [ -z "$result" ]; then
            write_error_log "No result field in cursor-agent response"
            write_debug_log "Full response: $task_json"
            exit 1
        fi
        
        write_debug_log "Extracted result (first 1000 chars): ${result:0:1000}"
        
        # Try to extract JSON from markdown code fences if present
        if echo "$result" | grep -q '```json'; then
            write_debug_log "Found markdown code fences, extracting JSON with Python..."
            
            # Use Python for robust extraction
            local temp_input=$(mktemp)
            local temp_output=$(mktemp)
            echo "$result" > "$temp_input"
            
            python3 << 'PYTHON_EOF' > "$temp_output" 2>/dev/null
import sys
import re

# Read input
with open(sys.argv[1], 'r') as f:
    text = f.read()

# Extract JSON from markdown code fences
# Pattern: ```json ... ``` (with optional whitespace)
pattern = r'```json\s*\n(.*?)\n```'
match = re.search(pattern, text, re.DOTALL)

if match:
    json_content = match.group(1).strip()
    print(json_content)
else:
    # Fallback: just output the text
    sys.stderr.write("No JSON code fence found\n")
    print(text)
PYTHON_EOF
            python3 -c "
import sys, re
with open('$temp_input', 'r') as f:
    text = f.read()
pattern = r'\`\`\`json\s*\n(.*?)\n\`\`\`'
match = re.search(pattern, text, re.DOTALL)
if match:
    print(match.group(1).strip())
else:
    sys.stderr.write('No JSON code fence found\n')
    print(text)
" > "$temp_output" 2>/dev/null
            
            task_json=$(cat "$temp_output")
            
            rm -f "$temp_input" "$temp_output"
            
            # If still empty, try manual extraction
            if [ -z "$task_json" ]; then
                write_warn_log "Python extraction failed, trying grep/awk..."
                task_json=$(echo "$result" | grep -Pzo '(?<=```json\n)[\s\S]*?(?=\n```)' | tr -d '\0' || echo "$result")
            fi
        else
            write_debug_log "No markdown fences, using result as-is"
            task_json="$result"
        fi
        
        write_debug_log "Final task_json (first 500 chars): ${task_json:0:500}"
        
        # Extract only the JSON part (from { to })
        # This handles cases where Cursor adds narrative text before the JSON
        if ! echo "$task_json" | jq empty 2>/dev/null; then
            write_debug_log "Initial JSON validation failed, extracting JSON object..."
            
            # Try to extract JSON object using Python
            local cleaned_json=$(echo "$task_json" | python3 -c '
import sys, re, json
text = sys.stdin.read()

# Try to find JSON object (from { to })
match = re.search(r"\{.*\}", text, re.DOTALL)
if match:
    try:
        # Validate it is valid JSON
        obj = json.loads(match.group(0))
        print(json.dumps(obj))
    except:
        # If parsing fails, output original
        print(text)
else:
    print(text)
' 2>/dev/null)
            
            if [ -n "$cleaned_json" ] && echo "$cleaned_json" | jq empty 2>/dev/null; then
                task_json="$cleaned_json"
                write_debug_log "Successfully extracted JSON object"
            else
                write_error_log "Invalid JSON received for ticket $TICKET_ID"
                write_debug_log "Full response: $task_json"
                exit 1
            fi
        fi
        
        # Verify we got the right ticket
        local fetched_id=$(echo "$task_json" | jq -r '.id // empty')
        write_debug_log "Fetched ID: '$fetched_id'"
        write_debug_log "Expected ID: '$TICKET_ID'"
        
        if [ -z "$fetched_id" ]; then
            write_error_log "Received task with empty ID"
            write_debug_log "Task JSON keys: $(echo "$task_json" | jq -r 'keys | join(", ")')"
            write_debug_log "Full task JSON: $task_json"
            exit 1
        fi
        
        if [ "$fetched_id" != "$TICKET_ID" ]; then
            write_error_log "Received wrong ticket: $fetched_id instead of $TICKET_ID"
            write_debug_log "Full task JSON: $task_json"
            exit 1
        fi
        
        local ticket_title=$(echo "$task_json" | jq -r '.title // "Unknown"')
        write_info_log "Ticket found: $ticket_title"
        
        process_ticket "$task_json"
        return
    fi

    # Start bot
    start_bot
}

# Execute
main "$@"
