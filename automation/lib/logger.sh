#!/bin/bash
# Logging module for the automation system
# Provides logging functions with different levels and file rotation

# Global variables
LOG_DIRECTORY=""
LOG_LEVEL="INFO"
LOG_TO_CONSOLE=true
CURRENT_LOG_FILE=""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
GRAY='\033[0;90m'
NC='\033[0m'

# Initialize the logging system
initialize_logger() {
    local log_dir="${1:-$(dirname "$0")/../logs}"
    local level="${2:-INFO}"
    local to_console="${3:-true}"
    
    LOG_DIRECTORY="$log_dir"
    LOG_LEVEL="$level"
    LOG_TO_CONSOLE="$to_console"
    
    # Create the log directory if it doesn't exist
    mkdir -p "$LOG_DIRECTORY"
    
    # Set today's log file
    local date_string=$(date +%Y-%m-%d)
    CURRENT_LOG_FILE="$LOG_DIRECTORY/ticket-bot-$date_string.log"
    
    write_log_message "INFO" "Logging system initialized"
    write_log_message "INFO" "Log level: $level"
    write_log_message "INFO" "Log file: $CURRENT_LOG_FILE"
}

# Get the priority of a log level
get_log_level_priority() {
    local level="$1"
    
    case "$level" in
        "DEBUG") echo 0 ;;
        "INFO")  echo 1 ;;
        "WARN")  echo 2 ;;
        "ERROR") echo 3 ;;
        *)       echo 1 ;;
    esac
}

# Write a log message
write_log_message() {
    local level="$1"
    local message="$2"
    local context="${3:-}"
    
    # Check the log level
    local current_priority=$(get_log_level_priority "$LOG_LEVEL")
    local message_priority=$(get_log_level_priority "$level")
    
    if [ "$message_priority" -lt "$current_priority" ]; then
        return
    fi
    
    # Format the message
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_line="[$timestamp] [$level] $message"
    
    # Add context if present
    if [ -n "$context" ]; then
        log_line="$log_line | Context: $context"
    fi
    
    # Write to the file
    if [ -n "$CURRENT_LOG_FILE" ]; then
        echo "$log_line" >> "$CURRENT_LOG_FILE"
    fi
    
    # Write to the console if enabled
    if [ "$LOG_TO_CONSOLE" = true ]; then
        local color="$NC"
        case "$level" in
            "DEBUG") color="$GRAY" ;;
            "INFO")  color="$NC" ;;
            "WARN")  color="$YELLOW" ;;
            "ERROR") color="$RED" ;;
        esac
        echo -e "${color}${log_line}${NC}" >&2
    fi
}

# Convenience functions
write_debug_log() {
    write_log_message "DEBUG" "$1" "${2:-}"
}

write_info_log() {
    write_log_message "INFO" "$1" "${2:-}"
}

write_warn_log() {
    write_log_message "WARN" "$1" "${2:-}"
}

write_error_log() {
    write_log_message "ERROR" "$1" "${2:-}"
}

# Clean old log files
clear_old_logs() {
    local days_to_keep="${1:-30}"
    
    write_info_log "Cleaning logs older than $days_to_keep days"
    
    find "$LOG_DIRECTORY" -name "ticket-bot-*.log" -type f -mtime "+$days_to_keep" | while read -r logfile; do
        write_info_log "Deleting old log file: $(basename "$logfile")"
        rm -f "$logfile"
    done
}

