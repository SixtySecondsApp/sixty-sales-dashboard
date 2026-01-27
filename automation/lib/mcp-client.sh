#!/bin/bash
# MCP client module for interacting with AI Dev Hub via Cursor CLI
# Provides functions to retrieve and update tasks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/logger.sh"

# Execute a Cursor CLI command with retry
invoke_cursor_cli() {
    local prompt="$1"
    local model="${2:-auto}"
    local output_format="${3:-text}"
    local max_retries="${4:-3}"
    local timeout_seconds="${5:-300}"
    
    local attempt=0
    local last_error=""
    
    while [ $attempt -lt $max_retries ]; do
        attempt=$((attempt + 1))
        
        write_debug_log "Attempt $attempt/$max_retries: Executing cursor-agent"
        
        # Create a temporary file for the output
        local output_file=$(mktemp)
        local error_file=$(mktemp)
        
        # Execute cursor-agent with timeout, MCP approval, and force execution
        if timeout "$timeout_seconds" cursor-agent -p --approve-mcps --force --model "$model" --output-format "$output_format" "$prompt" > "$output_file" 2> "$error_file"; then
            local result=$(cat "$output_file")
            rm -f "$output_file" "$error_file"
            
            write_debug_log "cursor-agent command succeeded"
            echo "$result"
            return 0
        else
            local exit_code=$?
            last_error=$(cat "$error_file")
            
            if [ $exit_code -eq 124 ]; then
                last_error="Timeout after $timeout_seconds seconds"
                write_warn_log "Attempt $attempt timeout: $last_error"
            else
                write_warn_log "Attempt $attempt failed (code $exit_code): $last_error"
            fi
            
            rm -f "$output_file" "$error_file"
        fi
        
        # Wait before retrying (except after the last attempt)
        if [ $attempt -lt $max_retries ]; then
            local wait_seconds=$((attempt * 2))
            write_debug_log "Waiting $wait_seconds seconds before retrying"
            sleep "$wait_seconds"
        fi
    done
    
    # All attempts failed
    write_error_log "Failure after $max_retries attempts: $last_error"
    return 1
}

# Retrieve "todo" tasks for a project
get_todo_tasks() {
    local project_id="$1"
    local limit="${2:-10}"
    
    write_info_log "Retrieving 'todo' tasks for project $project_id"
    
    # Request JSON output format directly from the MCP tool
    # Use a very explicit prompt to force raw JSON output without any interpretation
    local prompt="IMPORTANT: Do NOT analyze, interpret, or explain anything. Simply execute this MCP tool call and return its raw output.

Use the MCP tool 'search_tasks' from server 'ai-dev-hub-mcp-server' with these parameters:
- projectId: \"$project_id\"
- status: [\"todo\"]
- limit: $limit
- outputFormat: \"json\"

Return ONLY the raw JSON array that the tool outputs. No commentary, no analysis, no extra text."
    
    local result
    if result=$(invoke_cursor_cli "$prompt" "auto" "json"); then
        write_debug_log "Raw output from cursor-agent (first 500 chars): ${result:0:500}"
        
        # Use temporary files to avoid shell variable size limits with large JSON
        local tmp_raw=$(mktemp)
        local tmp_result=$(mktemp)
        local tmp_final=$(mktemp)
        
        # Write result to temp file
        echo "$result" > "$tmp_raw"
        
        # Extract the JSON wrapper (line containing "type":"result")
        grep -E '^\{.*"type".*"result"' "$tmp_raw" | head -1 > "$tmp_result"
        
        if [ ! -s "$tmp_result" ]; then
            write_error_log "Could not find JSON wrapper in cursor-agent output"
            write_debug_log "First 1000 chars of output: $(head -c 1000 "$tmp_raw")"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        write_debug_log "Extracted JSON wrapper (first 500 chars): $(head -c 500 "$tmp_result")"
        
        # Extract the "result" field from the wrapper
        if ! jq -r '.result' "$tmp_result" > "$tmp_final" 2>/dev/null; then
            write_error_log "Could not extract 'result' field from JSON wrapper"
            write_debug_log "Wrapper content (first 1000 chars): $(head -c 1000 "$tmp_result")"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        if [ ! -s "$tmp_final" ]; then
            write_error_log "'result' field is empty or null"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        write_debug_log "Extracted result content (first 500 chars): $(head -c 500 "$tmp_final")"
        
        # The result might still be wrapped in markdown code fences
        # Extract JSON from ```json ... ``` blocks if present
        if grep -q '```json' "$tmp_final" 2>/dev/null; then
            write_debug_log "Found markdown code fences, extracting JSON"
            # Use Python for reliable extraction (handles embedded backticks)
            if command -v python3 &> /dev/null; then
                python3 -c "
import sys
content = open('$tmp_final', 'r').read()
start = content.find('\`\`\`json')
end = content.rfind('\`\`\`')
if start >= 0 and end > start:
    # Extract between first \`\`\`json and last \`\`\`
    json_content = content[start + 7:end].strip()
    print(json_content)
else:
    print(content)
" > "${tmp_final}.clean" 2>/dev/null && mv "${tmp_final}.clean" "$tmp_final" || {
                    write_warn_log "Python extraction failed, trying sed fallback"
                    # Fallback: use sed with line numbers
                    sed -n '/\`\`\`json/,/\`\`\`/p' "$tmp_final" | sed '1d;$d' > "${tmp_final}.clean" 2>/dev/null
                    [ -s "${tmp_final}.clean" ] && mv "${tmp_final}.clean" "$tmp_final"
                }
            else
                write_warn_log "Python3 not available, using sed fallback"
                sed -n '/\`\`\`json/,/\`\`\`/p' "$tmp_final" | sed '1d;$d' > "${tmp_final}.clean" 2>/dev/null
                [ -s "${tmp_final}.clean" ] && mv "${tmp_final}.clean" "$tmp_final"
            fi
        else
            write_debug_log "No markdown code fences found, using result as-is"
        fi
        
        write_debug_log "Final JSON (first 500 chars): $(head -c 500 "$tmp_final")"
        
        # Validate that it's valid JSON
        if ! jq empty "$tmp_final" 2>/dev/null; then
            write_error_log "Final output is not valid JSON"
            write_debug_log "Invalid JSON (first 2000 chars): $(head -c 2000 "$tmp_final")"
            write_debug_log "Invalid JSON (last 500 chars): $(tail -c 500 "$tmp_final")"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            echo "[]"
            return 1
        fi
        
        # Extract the tasks array from the pagination structure
        local tasks_array=$(jq -r '.tasks' "$tmp_final" 2>/dev/null)
        
        if [ -z "$tasks_array" ] || [ "$tasks_array" = "null" ]; then
            write_warn_log "No 'tasks' array found in response, checking if entire JSON is an array"
            # Check if the entire JSON is already an array
            if jq -e 'type == "array"' "$tmp_final" > /dev/null 2>&1; then
                write_debug_log "JSON is already an array, using it directly"
                tasks_array=$(cat "$tmp_final")
            else
                write_error_log "Response is not a pagination structure with 'tasks' field, and not an array"
                write_debug_log "Response structure: $(jq 'keys' "$tmp_final" 2>/dev/null || echo 'Unable to extract keys')"
                rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
                echo "[]"
                return 1
            fi
        fi
        
        write_debug_log "Tasks array (first 500 chars): ${tasks_array:0:500}"
        
        # Count tasks safely
        local task_count
        if task_count=$(echo "$tasks_array" | jq '. | length' 2>/dev/null); then
            write_info_log "Retrieved $task_count 'todo' task(s)"
        else
            write_error_log "Failed to count tasks in array"
            write_debug_log "Tasks array (first 1000 chars): ${tasks_array:0:1000}"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            echo "[]"
            return 1
        fi
        
        # Clean up temp files
        rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
        
        echo "$tasks_array"
        return 0
    else
        write_error_log "Unable to retrieve tasks from cursor-agent"
        echo "[]"
        return 1
    fi
}

# Retrieve the details of a task
get_task_details() {
    local task_id="$1"
    
    write_info_log "Retrieving details for task $task_id"
    
    # Request JSON output format directly from the MCP tool
    # Use a very explicit prompt to force raw JSON output without any interpretation
    local prompt="IMPORTANT: Do NOT analyze, interpret, or explain anything. Simply execute this MCP tool call and return its raw output.

Use the MCP tool 'get_task' from server 'ai-dev-hub-mcp-server' with these parameters:
- taskId: \"$task_id\"
- outputFormat: \"json\"

Return ONLY the raw JSON that the tool outputs. No commentary, no analysis, no extra text."
    
    local result
    if result=$(invoke_cursor_cli "$prompt" "auto" "json"); then
        write_debug_log "Raw output from cursor-agent (first 500 chars): ${result:0:500}"
        
        # Clean the output: remove debug log lines that may be mixed in
        # Keep only lines that look like JSON (starting with { or containing "type":"result")
        local clean_json=$(echo "$result" | grep -E '^\{.*"type".*"result"' | head -1)
        
        if [ -z "$clean_json" ]; then
            write_error_log "Could not find JSON in cursor-agent output"
            write_debug_log "Full output: $result"
            return 1
        fi
        
        write_debug_log "Cleaned JSON wrapper: ${clean_json:0:200}..."
        
        # Extract the 'result' field from the cursor-agent JSON wrapper
        local task_result=$(echo "$clean_json" | jq -r '.result' 2>/dev/null)
        
        if [ -z "$task_result" ] || [ "$task_result" = "null" ]; then
            write_error_log "Could not extract result field from cursor-agent JSON wrapper"
            write_debug_log "Clean JSON: $clean_json"
            return 1
        fi
        
        write_debug_log "Extracted result from wrapper (first 200 chars): ${task_result:0:200}"
        
        # The result contains the JSON in a markdown code block (```json ... ```)
        # Use temp files to avoid variable size limits
        local tmp_task=$(mktemp)
        echo "$task_result" > "$tmp_task"
        
        if grep -q '```json' "$tmp_task" 2>/dev/null; then
            write_debug_log "Found markdown code fences, extracting JSON"
            # Use Python for reliable extraction (handles embedded backticks)
            if command -v python3 &> /dev/null; then
                python3 -c "
import sys
content = open('$tmp_task', 'r').read()
start = content.find('\`\`\`json')
end = content.rfind('\`\`\`')
if start >= 0 and end > start:
    json_content = content[start + 7:end].strip()
    print(json_content)
else:
    print(content)
" > "${tmp_task}.json" 2>/dev/null || {
                    write_warn_log "Python extraction failed, trying sed fallback"
                    sed -n '/\`\`\`json/,/\`\`\`/p' "$tmp_task" | sed '1d;$d' > "${tmp_task}.json" 2>/dev/null
                }
            else
                write_warn_log "Python3 not available, using sed fallback"
                sed -n '/\`\`\`json/,/\`\`\`/p' "$tmp_task" | sed '1d;$d' > "${tmp_task}.json" 2>/dev/null
            fi
        else
            write_debug_log "No markdown code fences found, using result as-is"
            cat "$tmp_task" > "${tmp_task}.json"
        fi
        
        # Validate the extracted JSON
        if [ ! -s "${tmp_task}.json" ]; then
            write_error_log "Extracted JSON is empty"
            write_debug_log "Result content (first 500 chars): ${task_result:0:500}"
            rm -f "$tmp_task" "${tmp_task}.json"
            return 1
        fi
        
        write_debug_log "Extracted JSON (first 200 chars): $(head -c 200 "${tmp_task}.json")"
        
        # Validate the JSON
        if jq empty "${tmp_task}.json" 2>/dev/null; then
            # Validate that it has the required fields
            local task_id=$(jq -r '.id' "${tmp_task}.json" 2>/dev/null)
            local task_title=$(jq -r '.title' "${tmp_task}.json" 2>/dev/null)
            
            if [ -n "$task_id" ] && [ "$task_id" != "null" ] && [ -n "$task_title" ] && [ "$task_title" != "null" ]; then
                write_info_log "Details retrieved for task: $task_title"
                local task_json=$(cat "${tmp_task}.json")
                rm -f "$tmp_task" "${tmp_task}.json"
                echo "$task_json"
                return 0
            else
                write_error_log "Task JSON missing required fields (id or title)"
                write_debug_log "Task JSON (first 500 chars): $(head -c 500 "${tmp_task}.json")"
                rm -f "$tmp_task" "${tmp_task}.json"
                return 1
            fi
        else
            write_error_log "Invalid JSON format"
            write_debug_log "Task JSON (first 500 chars): $(head -c 500 "${tmp_task}.json")"
            rm -f "$tmp_task" "${tmp_task}.json"
            return 1
        fi
    else
        write_error_log "Unable to retrieve task details"
        return 1
    fi
}

# Update the status of a task
update_task_status() {
    local task_id="$1"
    local new_status="$2"
    
    write_info_log "Updating status of task $task_id to '$new_status'"
    
    local prompt="Use the MCP tool 'update_task' from server 'ai-dev-hub-mcp-server' with:
- taskId: \"$task_id\"
- status: \"$new_status\"

Confirm the update was successful."
    
    if invoke_cursor_cli "$prompt" "auto" "text" > /dev/null; then
        write_info_log "Task status updated successfully"
        return 0
    else
        write_error_log "Unable to update the status of the task"
        return 1
    fi
}

# Create a comment on a task
add_task_comment() {
    local task_id="$1"
    local comment="$2"
    
    write_info_log "Adding a comment to task $task_id"
    
    # Escape quotes in the comment
    local escaped_comment=$(echo "$comment" | sed 's/"/\\"/g')
    
    local prompt="Use the MCP tool 'create_comment' from server 'ai-dev-hub-mcp-server' with:
- taskId: \"$task_id\"
- content: \"$escaped_comment\"

Confirm the comment was added successfully."
    
    if invoke_cursor_cli "$prompt" "auto" "text" > /dev/null; then
        write_info_log "Comment added successfully"
        return 0
    else
        write_error_log "Unable to add comment"
        return 1
    fi
}

# ============================================================================
# Automation Job Functions
# ============================================================================

# Get the next pending automation job for a project
get_next_pending_job() {
    local project_id="$1"
    
    write_info_log "Retrieving next pending automation job for project $project_id"
    
    local prompt="IMPORTANT: Do NOT analyze, interpret, or explain anything. Simply execute this MCP tool call and return its raw output.

Use the MCP tool 'get_next_pending_job' from server 'ai-dev-hub-mcp-server' with these parameters:
- projectId: \"$project_id\"
- outputFormat: \"json\"

Return ONLY the raw JSON object that the tool outputs. No commentary, no analysis, no extra text."
    
    local result
    if result=$(invoke_cursor_cli "$prompt" "auto" "json"); then
        write_debug_log "Raw output from cursor-agent (first 500 chars): ${result:0:500}"
        
        # Use temporary files to avoid shell variable size limits
        local tmp_raw=$(mktemp)
        local tmp_result=$(mktemp)
        local tmp_final=$(mktemp)
        
        # Write result to temp file
        echo "$result" > "$tmp_raw"
        
        # Extract the JSON wrapper
        grep -E '^\{.*"type".*"result"' "$tmp_raw" | head -1 > "$tmp_result"
        
        if [ ! -s "$tmp_result" ]; then
            write_error_log "Could not find JSON wrapper in cursor-agent output"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        # Extract the "result" field
        if ! jq -r '.result' "$tmp_result" > "$tmp_final" 2>/dev/null; then
            write_error_log "Could not extract 'result' field from JSON wrapper"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        # Check if result is null (no pending jobs)
        local result_content=$(cat "$tmp_final")
        if [ "$result_content" = "null" ] || [ -z "$result_content" ]; then
            write_info_log "No pending automation jobs found"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            echo "null"
            return 0
        fi
        
        # Extract JSON from markdown code fences if present
        if grep -q '```json' "$tmp_final" 2>/dev/null; then
            write_debug_log "Found markdown code fences, extracting JSON"
            if command -v python3 &> /dev/null; then
                python3 -c "
import sys
content = open('$tmp_final', 'r').read()
start = content.find('\`\`\`json')
end = content.rfind('\`\`\`')
if start >= 0 and end > start:
    json_content = content[start + 7:end].strip()
    print(json_content)
else:
    print(content)
" > "${tmp_final}.clean" 2>/dev/null && mv "${tmp_final}.clean" "$tmp_final"
            fi
        fi
        
        # Validate JSON
        if ! jq empty "$tmp_final" 2>/dev/null; then
            write_error_log "Final output is not valid JSON"
            rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
            return 1
        fi
        
        local job_json=$(cat "$tmp_final")
        rm -f "$tmp_raw" "$tmp_result" "$tmp_final"
        
        # Extract job ID for logging
        local job_id=$(echo "$job_json" | jq -r '.id // empty' 2>/dev/null)
        if [ -n "$job_id" ]; then
            write_info_log "Retrieved automation job: $job_id"
        fi
        
        echo "$job_json"
        return 0
    else
        write_error_log "Unable to retrieve next pending job"
        return 1
    fi
}

# Update the status of an automation job
update_job_status() {
    local job_id="$1"
    local new_status="$2"
    local error_msg="${3:-}"
    
    write_info_log "Updating automation job $job_id status to '$new_status'"
    
    local prompt="Use the MCP tool 'update_job_status' from server 'ai-dev-hub-mcp-server' with:
- jobId: \"$job_id\"
- status: \"$new_status\""
    
    if [ -n "$error_msg" ]; then
        # Escape quotes in error message
        local escaped_error=$(echo "$error_msg" | sed 's/"/\\"/g')
        prompt="$prompt
- error: \"$escaped_error\""
    fi
    
    prompt="$prompt

Confirm the update was successful."
    
    if invoke_cursor_cli "$prompt" "auto" "text" > /dev/null; then
        write_info_log "Job status updated successfully"
        return 0
    else
        write_error_log "Unable to update job status"
        return 1
    fi
}

# Update PR details for an automation job
update_job_pr() {
    local job_id="$1"
    local pr_url="$2"
    local pr_number="${3:-}"
    local branch_name="$4"
    
    write_info_log "Updating PR details for automation job $job_id"
    
    local prompt="Use the MCP tool 'update_job_pr' from server 'ai-dev-hub-mcp-server' with:
- jobId: \"$job_id\"
- prUrl: \"$pr_url\"
- branchName: \"$branch_name\""
    
    if [ -n "$pr_number" ]; then
        prompt="$prompt
- prNumber: $pr_number"
    fi
    
    prompt="$prompt

Confirm the PR details were saved successfully."
    
    if invoke_cursor_cli "$prompt" "auto" "text" > /dev/null; then
        write_info_log "PR details updated successfully"
        return 0
    else
        write_error_log "Unable to update PR details"
        return 1
    fi
}

# Get details of an automation job (for debugging)
get_job_details() {
    local job_id="$1"
    
    write_info_log "Retrieving details for automation job $job_id"
    
    local prompt="Use the MCP tool 'get_job_details' from server 'ai-dev-hub-mcp-server' with:
- jobId: \"$job_id\"
- outputFormat: \"json\"

Return ONLY the raw JSON object."
    
    local result
    if result=$(invoke_cursor_cli "$prompt" "auto" "json"); then
        echo "$result"
        return 0
    else
        write_error_log "Unable to retrieve job details"
        return 1
    fi
}

# Update git statistics for an automation job
update_job_stats() {
    local job_id="$1"
    local files_changed="$2"
    local lines_added="$3"
    local lines_removed="$4"
    
    write_info_log "Updating git statistics for job $job_id"
    
    local prompt="Use the MCP tool 'update_job_stats' from server 'ai-dev-hub-mcp-server' with:
- jobId: \"$job_id\"
- filesChanged: $files_changed
- linesAdded: $lines_added
- linesRemoved: $lines_removed

Confirm the update was successful."
    
    if invoke_cursor_cli "$prompt" "auto" "text" > /dev/null; then
        write_info_log "Git statistics updated successfully"
        return 0
    else
        write_error_log "Unable to update git statistics"
        return 1
    fi
}

# ============================================================================
# Multi-Project Support Functions
# ============================================================================

# Get pending jobs from all projects
# Arguments: JSON array of project IDs (e.g., '["id1", "id2", "id3"]')
# Returns: JSON array of all pending jobs from all projects
get_all_pending_jobs() {
    local project_ids_json="$1"
    
    write_info_log "Retrieving pending jobs from all projects"
    
    # Initialize empty array for all jobs
    local all_jobs="[]"
    
    # Parse project IDs from JSON array
    local project_count=$(echo "$project_ids_json" | jq -r 'length')
    write_debug_log "Processing $project_count project(s)"
    
    for i in $(seq 0 $((project_count - 1))); do
        local project_id=$(echo "$project_ids_json" | jq -r ".[$i]")
        write_debug_log "Fetching job for project: $project_id"
        
        local job_json
        if job_json=$(get_next_pending_job "$project_id"); then
            # Check if we got a valid job (not null or empty)
            if [ "$job_json" != "null" ] && [ -n "$job_json" ]; then
                # Add project ID to the job for reference
                job_json=$(echo "$job_json" | jq --arg pid "$project_id" '. + {sourceProjectId: $pid}')
                # Append to all_jobs array
                all_jobs=$(echo "$all_jobs" | jq --argjson job "$job_json" '. + [$job]')
                write_debug_log "Found pending job in project $project_id"
            else
                write_debug_log "No pending job in project $project_id"
            fi
        else
            write_warn_log "Failed to fetch job from project $project_id"
        fi
    done
    
    local total_jobs=$(echo "$all_jobs" | jq 'length')
    write_info_log "Retrieved $total_jobs pending job(s) from all projects"
    
    echo "$all_jobs"
    return 0
}

# Select the highest priority job from a list of jobs
# Priority order: critical (4) > high (3) > medium (2) > low (1)
# Tie-breaker: earliest createdAt date (FIFO)
# Arguments: JSON array of jobs
# Returns: The selected job JSON object, or "null" if no jobs
select_highest_priority_job() {
    local jobs_json="$1"
    
    local job_count=$(echo "$jobs_json" | jq 'length')
    
    if [ "$job_count" -eq 0 ]; then
        write_debug_log "No jobs to select from"
        echo "null"
        return 0
    fi
    
    if [ "$job_count" -eq 1 ]; then
        write_debug_log "Only one job available, selecting it"
        echo "$jobs_json" | jq '.[0]'
        return 0
    fi
    
    write_debug_log "Selecting highest priority job from $job_count candidates"
    
    # Sort jobs by priority (descending) then by createdAt (ascending)
    # Priority mapping: critical=4, high=3, medium=2, low=1
    local selected_job=$(echo "$jobs_json" | jq '
        def priority_value:
            if . == "critical" then 4
            elif . == "high" then 3
            elif . == "medium" then 2
            elif . == "low" then 1
            else 0
            end;
        
        sort_by(
            - (.Task.priority | priority_value),
            .createdAt
        ) | .[0]
    ')
    
    local selected_id=$(echo "$selected_job" | jq -r '.id // "unknown"')
    local selected_priority=$(echo "$selected_job" | jq -r '.Task.priority // "unknown"')
    local selected_title=$(echo "$selected_job" | jq -r '.Task.title // "unknown"')
    
    write_info_log "Selected job: $selected_id (priority: $selected_priority, title: $selected_title)"
    
    echo "$selected_job"
    return 0
}

