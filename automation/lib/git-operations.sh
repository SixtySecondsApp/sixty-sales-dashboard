#!/bin/bash
# Git operations module for ticket automation
# Provides functions to create branches, commit, and create PRs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/logger.sh"

# Check that Git is properly configured
test_git_configuration() {
    write_debug_log "Checking Git configuration"
    
    # Check that git is available
    if ! command -v git &> /dev/null; then
        write_error_log "Git is not installed or not in PATH"
        return 1
    fi
    
    local git_version=$(git --version)
    write_debug_log "Git version: $git_version"
    
    # Check user configuration
    local user_name=$(git config user.name 2>/dev/null)
    local user_email=$(git config user.email 2>/dev/null)
    
    if [ -z "$user_name" ] || [ -z "$user_email" ]; then
        write_warn_log "Incomplete Git configuration (missing user.name or user.email)"
        return 1
    fi
    
    write_debug_log "Git configured for: $user_name <$user_email>"
    return 0
}

# Check that GitHub CLI is set up
test_github_cli() {
    write_debug_log "Checking GitHub CLI"
    
    if ! command -v gh &> /dev/null; then
        write_warn_log "GitHub CLI (gh) is not installed"
        return 1
    fi
    
    local gh_version=$(gh --version | head -1)
    write_debug_log "GitHub CLI version: $gh_version"
    
    # Check authentication
    if ! gh auth status &> /dev/null; then
        write_warn_log "GitHub CLI is not authenticated. Run: gh auth login"
        return 1
    fi
    
    write_debug_log "GitHub CLI successfully authenticated"
    return 0
}

# Ensure we are on the main branch and it's up to date
update_main_branch() {
    local main_branch="${1:-main}"
    local remote="${2:-origin}"
    
    write_info_log "Updating main branch: $main_branch"
    
    # Fetch latest changes
    write_debug_log "Running: git fetch $remote"
    if ! git fetch "$remote" &> /dev/null; then
        write_error_log "Failed to git fetch"
        return 1
    fi
    
    # Checkout the main branch
    write_debug_log "Running: git checkout $main_branch"
    if ! git checkout "$main_branch" &> /dev/null; then
        write_error_log "Failed to git checkout $main_branch"
        return 1
    fi
    
    # Pull latest changes
    write_debug_log "Running: git pull $remote $main_branch"
    if ! git pull "$remote" "$main_branch" &> /dev/null; then
        write_error_log "Failed to git pull"
        return 1
    fi
    
    write_info_log "Main branch successfully updated"
    return 0
}

# Create a new branch for a ticket
new_ticket_branch() {
    local task_id="$1"
    local branch_prefix="${2:-auto/ticket-}"
    
    local branch_name="${branch_prefix}${task_id}"
    write_info_log "Creating branch: $branch_name"
    
    # Check if the branch already exists locally
    if git branch --list "$branch_name" | grep -q "$branch_name"; then
        write_warn_log "Branch $branch_name already exists locally. Deleting..."
        git branch -D "$branch_name" &> /dev/null
    fi
    
    # Create the new branch
    write_debug_log "Running: git checkout -b $branch_name"
    if ! git checkout -b "$branch_name" &> /dev/null; then
        write_error_log "Failed to create branch"
        return 1
    fi
    
    write_info_log "Branch successfully created: $branch_name"
    echo "$branch_name"
    return 0
}

# Commit all changes
save_changes() {
    local message="$1"
    local author_name="${2:-}"
    local author_email="${3:-}"
    
    write_info_log "Committing changes"
    
    # Add all files
    write_debug_log "Running: git add -A"
    if ! git add -A &> /dev/null; then
        write_error_log "Failed to git add"
        return 1
    fi
    
    # Check if there are changes to commit
    if [ -z "$(git status --porcelain)" ]; then
        write_warn_log "No changes to commit"
        return 0
    fi
    
    # Commit with a specific author if provided
    if [ -n "$author_name" ] && [ -n "$author_email" ]; then
        write_debug_log "Committing with author: $author_name <$author_email>"
        if ! git -c "user.name=$author_name" -c "user.email=$author_email" commit -m "$message" &> /dev/null; then
            write_error_log "Failed to git commit"
            return 1
        fi
    else
        write_debug_log "Running: git commit -m '$message'"
        if ! git commit -m "$message" &> /dev/null; then
            write_error_log "Failed to git commit"
            return 1
        fi
    fi
    
    write_info_log "Changes successfully committed"
    return 0
}

# Push the branch to the remote
push_branch() {
    local branch_name="$1"
    local remote="${2:-origin}"
    
    write_info_log "Pushing branch: $branch_name to $remote"
    
    write_debug_log "Running: git push -u $remote $branch_name"
    if ! git push -u "$remote" "$branch_name" &> /dev/null; then
        write_error_log "Failed to git push"
        return 1
    fi
    
    write_info_log "Branch successfully pushed"
    return 0
}

# Create a Pull Request using GitHub CLI
new_pull_request() {
    local title="$1"
    local body="$2"
    local base_branch="${3:-main}"
    
    write_info_log "Creating Pull Request: $title"
    
    write_debug_log "Running: gh pr create --title '$title' --body '$body' --base $base_branch"
    local pr_url
    if pr_url=$(gh pr create --title "$title" --body "$body" --base "$base_branch" 2>&1); then
        write_info_log "Pull Request created: $pr_url"
        echo "$pr_url"
        return 0
    else
        write_error_log "Failed to create the PR"
        write_debug_log "Error: $pr_url"
        return 1
    fi
}

# Cleanup in case of error (switch back to main)
reset_to_main_branch() {
    local main_branch="${1:-main}"
    
    write_warn_log "Cleanup: switching back to branch $main_branch"
    
    # Discard all changes
    git reset --hard &> /dev/null
    git clean -fd &> /dev/null
    
    # Checkout main
    if git checkout "$main_branch" &> /dev/null; then
        write_info_log "Cleanup completed"
        return 0
    else
        write_error_log "Error during cleanup"
        return 1
    fi
}

# Get git statistics (files changed, lines added, lines removed)
get_git_stats() {
    local branch_name="$1"
    local base_branch="${2:-main}"
    
    write_debug_log "Calculating git stats for branch $branch_name vs $base_branch"
    
    # Get shortstat: "X files changed, Y insertions(+), Z deletions(-)"
    local stats=$(git diff --shortstat "$base_branch".."$branch_name" 2>/dev/null)
    
    if [ -z "$stats" ]; then
        write_warn_log "No git stats found (branch might be identical to base)"
        echo "0|0|0"
        return 0
    fi
    
    # Extract numbers using regex
    # Pattern: "X files changed" or "X file changed"
    local files_changed=$(echo "$stats" | grep -oE '[0-9]+ files? changed' | grep -oE '[0-9]+' || echo "0")
    
    # Pattern: "Y insertions(+)" or "Y insertion(+)"
    local lines_added=$(echo "$stats" | grep -oE '[0-9]+ insertions?' | grep -oE '[0-9]+' || echo "0")
    
    # Pattern: "Z deletions(-)" or "Z deletion(-)"
    local lines_removed=$(echo "$stats" | grep -oE '[0-9]+ deletions?' | grep -oE '[0-9]+' || echo "0")
    
    write_debug_log "Git stats: $files_changed files, +$lines_added/-$lines_removed lines"
    
    echo "$files_changed|$lines_added|$lines_removed"
    return 0
}

