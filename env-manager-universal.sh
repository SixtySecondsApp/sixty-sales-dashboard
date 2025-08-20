#!/bin/bash
# Universal Environment Variables Manager
# Works with any project - auto-detects project name from folder
# Usage: ./env-manager-universal.sh [setup|backup|restore|clean|status|help|init]

# Configuration - Auto-detect project name from current folder
if [ -n "$2" ]; then
    PROJECT_NAME="$2"
else
    PROJECT_NAME=$(basename "$(pwd)")
fi

SECRETS_ROOT="$HOME/Documents/project-secrets"
PROJECT_SECRETS_PATH="$SECRETS_ROOT/$PROJECT_NAME"
BACKUP_PATH="$SECRETS_ROOT/backup"
PROJECT_ROOT="$(pwd)"

# Color output functions
print_success() { echo -e "\033[32m$1\033[0m"; }
print_info() { echo -e "\033[36m$1\033[0m"; }
print_warning() { echo -e "\033[33m$1\033[0m"; }
print_error() { echo -e "\033[31m$1\033[0m"; }

# Initialize new project
initialize_project() {
    print_info "Initializing secrets management for: $PROJECT_NAME"
    
    # Create directories
    mkdir -p "$PROJECT_SECRETS_PATH"
    mkdir -p "$BACKUP_PATH"
    
    # Look for common ENV file patterns
    COMMON_PATTERNS=(
        ".env"
        ".env.local"
        ".env.development"
        ".env.production"
        "config/.env"
        "backend/.env"
        "frontend/.env"
        "frontend/.env.local"
        "server/.env"
        "client/.env"
        "api/.env"
        "app/.env"
    )
    
    print_info "Scanning for existing ENV files..."
    FOUND_FILES=()
    
    for pattern in "${COMMON_PATTERNS[@]}"; do
        test_path="$PROJECT_ROOT/$pattern"
        if [ -f "$test_path" ]; then
            FOUND_FILES+=("$pattern")
            print_success "  Found: $pattern"
        fi
    done
    
    if [ ${#FOUND_FILES[@]} -eq 0 ]; then
        print_warning "No ENV files found in project."
        print_info "Common ENV file locations:"
        for i in {0..5}; do
            if [ $i -lt ${#COMMON_PATTERNS[@]} ]; then
                print_info "  - ${COMMON_PATTERNS[$i]}"
            fi
        done
        
        # Create .env.example
        example_content="# Example environment variables file
# Copy this to .env and fill in your values

# Application
APP_NAME=$PROJECT_NAME
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=your_database_url_here

# API Keys
API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here

# Add more variables as needed"
        
        example_path="$PROJECT_ROOT/.env.example"
        if [ ! -f "$example_path" ]; then
            echo "$example_content" > "$example_path"
            print_success "Created .env.example template"
        fi
    else
        print_info "\nMoving ENV files to secure location..."
        for file in "${FOUND_FILES[@]}"; do
            source_path="$PROJECT_ROOT/$file"
            dest_path="$PROJECT_SECRETS_PATH/$file"
            
            # Create subdirectory if needed
            dest_dir=$(dirname "$dest_path")
            mkdir -p "$dest_dir"
            
            cp "$source_path" "$dest_path"
            print_success "  Secured: $file"
        done
        
        print_info "\nCreating project scripts..."
        
        # Create customized env-manager.sh
        script_path="$PROJECT_ROOT/env-manager.sh"
        cp "$0" "$script_path"
        chmod +x "$script_path"
        
        # Update .gitignore
        update_gitignore
        
        print_success "\nInitialization complete!"
        print_info "ENV files have been moved to: $PROJECT_SECRETS_PATH"
        print_info "Run './env-manager.sh clean' to remove them from the project"
        print_info "Run './env-manager.sh setup' to restore them when needed"
    fi
}

# Update .gitignore
update_gitignore() {
    gitignore_path="$PROJECT_ROOT/.gitignore"
    
    if [ -f "$gitignore_path" ]; then
        gitignore_content=$(cat "$gitignore_path" 2>/dev/null || echo "")
        
        env_patterns=(
            ".env"
            ".env.*"
            "*.env"
            "!.env.example"
            "!.env.sample"
        )
        
        needs_update=false
        for pattern in "${env_patterns[@]}"; do
            if ! grep -Fxq "$pattern" "$gitignore_path" 2>/dev/null; then
                needs_update=true
                break
            fi
        done
        
        if [ "$needs_update" = true ]; then
            env_section="
# Environment variables
.env
.env.*
*.env
!.env.example
!.env.sample"
            echo "$env_section" >> "$gitignore_path"
            print_success "Updated .gitignore with ENV patterns"
        fi
    else
        # Create new .gitignore
        gitignore_content="# Environment variables
.env
.env.*
*.env
!.env.example
!.env.sample

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
out/
.next/"
        echo "$gitignore_content" > "$gitignore_path"
        print_success "Created .gitignore with ENV patterns"
    fi
}

# Ensure secrets directory exists
ensure_secrets_directory() {
    if [ ! -d "$PROJECT_SECRETS_PATH" ]; then
        print_warning "Secrets directory not found. Creating..."
        mkdir -p "$PROJECT_SECRETS_PATH"
        mkdir -p "$BACKUP_PATH"
        print_success "Created secrets directory at: $PROJECT_SECRETS_PATH"
        print_info "Run 'init' command to scan for ENV files"
    fi
}

# Auto-detect ENV files in project
get_project_env_files() {
    ENV_FILES=()
    
    # Get all .env files recursively
    while IFS= read -r -d '' file; do
        if [[ ! "$file" =~ \.(example|sample|template)$ ]]; then
            rel_path="${file#$PROJECT_ROOT/}"
            ENV_FILES+=("$PROJECT_SECRETS_PATH/$rel_path:$file:$rel_path")
        fi
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f -print0 2>/dev/null || true)
}

# Setup function - copies ENV files from secrets to project
setup_environment() {
    print_info "Setting up environment variables for $PROJECT_NAME..."
    ensure_secrets_directory
    
    # Auto-detect or use stored structure
    get_project_env_files
    
    if [ ${#ENV_FILES[@]} -eq 0 ]; then
        # Try common locations
        COMMON_FILES=(
            "$PROJECT_SECRETS_PATH/.env:$PROJECT_ROOT/.env:.env"
            "$PROJECT_SECRETS_PATH/.env.local:$PROJECT_ROOT/.env.local:.env.local"
            "$PROJECT_SECRETS_PATH/backend/.env:$PROJECT_ROOT/backend/.env:backend/.env"
            "$PROJECT_SECRETS_PATH/frontend/.env.local:$PROJECT_ROOT/frontend/.env.local:frontend/.env.local"
        )
        
        for file_info in "${COMMON_FILES[@]}"; do
            IFS=':' read -r source dest rel <<< "$file_info"
            if [ -f "$source" ]; then
                ENV_FILES+=("$file_info")
            fi
        done
    fi
    
    if [ ${#ENV_FILES[@]} -eq 0 ]; then
        print_warning "No ENV files found in secrets folder."
        print_info "Run './env-manager.sh init' to scan and secure existing ENV files"
        return
    fi
    
    copied_count=0
    for file_info in "${ENV_FILES[@]}"; do
        IFS=':' read -r source dest rel <<< "$file_info"
        if [ -f "$source" ]; then
            # Create destination directory if needed
            dest_dir=$(dirname "$dest")
            mkdir -p "$dest_dir"
            
            cp "$source" "$dest"
            print_success "  [OK] Restored: $rel"
            ((copied_count++))
        fi
    done
    
    print_info "Setup complete! Restored $copied_count environment files."
}

# Backup function
backup_environment() {
    print_info "Creating backup of environment files..."
    ensure_secrets_directory
    
    timestamp=$(date '+%Y%m%d_%H%M%S')
    backup_dir="$BACKUP_PATH/$PROJECT_NAME-$timestamp"
    
    # Find all ENV files in project
    backed_up_count=0
    while IFS= read -r -d '' file; do
        if [[ ! "$file" =~ \.(example|sample|template)$ ]]; then
            rel_path="${file#$PROJECT_ROOT/}"
            backup_path="$backup_dir/$rel_path"
            secret_path="$PROJECT_SECRETS_PATH/$rel_path"
            
            # Create directories
            mkdir -p "$(dirname "$backup_path")"
            mkdir -p "$(dirname "$secret_path")"
            
            # Copy to backup and secrets
            cp "$file" "$backup_path"
            cp "$file" "$secret_path"
            
            print_success "  [OK] Backed up: $rel_path"
            ((backed_up_count++))
        fi
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f -print0 2>/dev/null || true)
    
    if [ $backed_up_count -eq 0 ]; then
        print_warning "No ENV files found to backup"
        return
    fi
    
    print_success "Backup complete! $backed_up_count files backed up to: $backup_dir"
}

# Clean function
clean_environment() {
    print_info "Cleaning environment files from project..."
    
    # Find all ENV files
    env_files_found=()
    while IFS= read -r -d '' file; do
        if [[ ! "$file" =~ \.(example|sample|template)$ ]]; then
            env_files_found+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f -print0 2>/dev/null || true)
    
    if [ ${#env_files_found[@]} -gt 0 ]; then
        print_info "Found ${#env_files_found[@]} ENV files. Creating backup first..."
        backup_environment
        
        # Remove files
        removed_count=0
        for file in "${env_files_found[@]}"; do
            rel_path="${file#$PROJECT_ROOT/}"
            rm -f "$file"
            print_success "  [OK] Removed: $rel_path"
            ((removed_count++))
        done
        
        print_success "Clean complete! Removed $removed_count environment files."
    else
        print_info "No ENV files found in project."
    fi
    
    print_info "Your ENV files are safely stored in: $PROJECT_SECRETS_PATH"
}

# Status function
show_status() {
    print_info "Environment Files Status for $PROJECT_NAME"
    print_info "=================================================="
    
    print_info "\nProject: $PROJECT_ROOT"
    print_info "Secrets: $PROJECT_SECRETS_PATH"
    
    # Find ENV files in project
    print_info "\nProject ENV Files:"
    project_files=()
    while IFS= read -r -d '' file; do
        if [[ ! "$file" =~ \.(example|sample|template)$ ]]; then
            project_files+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f -print0 2>/dev/null || true)
    
    if [ ${#project_files[@]} -gt 0 ]; then
        for file in "${project_files[@]}"; do
            rel_path="${file#$PROJECT_ROOT/}"
            size=$(wc -c < "$file" 2>/dev/null || echo "0")
            print_success "  [OK] $rel_path ($size bytes)"
        done
    else
        print_warning "  No ENV files in project"
    fi
    
    # Find ENV files in secrets
    print_info "\nSecured ENV Files:"
    if [ -d "$PROJECT_SECRETS_PATH" ]; then
        secret_files=()
        while IFS= read -r -d '' file; do
            if [[ ! "$file" =~ \.(example|sample|template)$ ]]; then
                secret_files+=("$file")
            fi
        done < <(find "$PROJECT_SECRETS_PATH" -name ".env*" -type f -print0 2>/dev/null || true)
        
        if [ ${#secret_files[@]} -gt 0 ]; then
            for file in "${secret_files[@]}"; do
                rel_path="${file#$PROJECT_SECRETS_PATH/}"
                size=$(wc -c < "$file" 2>/dev/null || echo "0")
                modified=$(date -r "$file" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "unknown")
                print_success "  [OK] $rel_path - $size bytes, modified: $modified"
            done
        else
            print_warning "  No ENV files in secrets folder"
        fi
    else
        print_warning "  Secrets folder not initialized"
    fi
    
    # Show recent backups
    print_info "\nRecent Backups:"
    if [ -d "$BACKUP_PATH" ]; then
        backups=($(find "$BACKUP_PATH" -maxdepth 1 -type d -name "$PROJECT_NAME-*" | sort -r | head -5))
        
        if [ ${#backups[@]} -gt 0 ]; then
            for backup in "${backups[@]}"; do
                backup_name=$(basename "$backup")
                print_info "  - $backup_name"
            done
        else
            print_warning "  No backups found"
        fi
    fi
}

# Help function
show_help() {
    print_info "Universal Environment Variables Manager
========================================
Current Project: $PROJECT_NAME

This script manages .env files stored securely in your Documents folder.
Secrets location: $PROJECT_SECRETS_PATH

USAGE:
  ./env-manager.sh [command]

COMMANDS:
  init     - Initialize secrets management for this project
  setup    - Copy ENV files from secrets folder to project
  backup   - Create timestamped backup of current ENV files
  restore  - Same as setup, restores ENV files from secrets
  clean    - Remove ENV files from project (auto-backups first)
  status   - Show current state of all ENV files
  help     - Show this help message

QUICK START FOR NEW PROJECT:
  1. Copy this script to your project
  2. Run: ./env-manager.sh init
  3. Follow the prompts

WORKFLOW:
  1. Clone project from GitHub
  2. Run: ./env-manager.sh setup
  3. Work on project normally
  4. Run: ./env-manager.sh clean (before deleting)
  
Your ENV files remain safe in: $SECRETS_ROOT"
}

# Make sure we have execute permissions
chmod +x "$0" 2>/dev/null || true

# Main execution
case "${1:-help}" in
    init)    initialize_project ;;
    setup)   setup_environment ;;
    backup)  backup_environment ;;
    restore) setup_environment ;;
    clean)   clean_environment ;;
    status)  show_status ;;
    help)    show_help ;;
    *)       show_help ;;
esac
