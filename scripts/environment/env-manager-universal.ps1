# Universal Environment Variables Manager
# Works with any project - auto-detects project name from folder
# Usage: .\env-manager-universal.ps1 [setup|backup|restore|clean|status]

param(
    [Parameter(Position=0)]
    [ValidateSet("setup", "backup", "restore", "clean", "status", "help", "init")]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$ProjectNameOverride = ""
)

# Configuration - Auto-detect project name from current folder
if ($ProjectNameOverride) {
    $ProjectName = $ProjectNameOverride
} else {
    $ProjectName = Split-Path -Leaf $PSScriptRoot
}

$SecretsRoot = "$env:USERPROFILE\Documents\project-secrets"
$ProjectSecretsPath = "$SecretsRoot\$ProjectName"
$BackupPath = "$SecretsRoot\backup"
$ProjectRoot = $PSScriptRoot

# Color output functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }
function Write-Warning { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Error { Write-Host $args[0] -ForegroundColor Red }

# Initialize new project
function Initialize-Project {
    Write-Info "Initializing secrets management for: $ProjectName"
    
    # Create directories
    New-Item -ItemType Directory -Force -Path $ProjectSecretsPath | Out-Null
    New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null
    
    # Look for common ENV file patterns
    $commonPatterns = @(
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        "config/.env",
        "backend/.env",
        "frontend/.env",
        "frontend/.env.local",
        "server/.env",
        "client/.env",
        "api/.env",
        "app/.env"
    )
    
    Write-Info "Scanning for existing ENV files..."
    $foundFiles = @()
    
    foreach ($pattern in $commonPatterns) {
        $testPath = Join-Path $ProjectRoot $pattern
        if (Test-Path $testPath -PathType Leaf) {
            $foundFiles += $pattern
            Write-Success "  Found: $pattern"
        }
    }
    
    if ($foundFiles.Count -eq 0) {
        Write-Warning "No ENV files found in project."
        Write-Info "Common ENV file locations:"
        foreach ($pattern in $commonPatterns[0..5]) {
            Write-Info "  - $pattern"
        }
        
        # Create .env.example
        $exampleContent = @"
# Example environment variables file
# Copy this to .env and fill in your values

# Application
APP_NAME=$ProjectName
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=your_database_url_here

# API Keys
API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here

# Add more variables as needed
"@
        $examplePath = Join-Path $ProjectRoot ".env.example"
        if (!(Test-Path $examplePath)) {
            Set-Content -Path $examplePath -Value $exampleContent
            Write-Success "Created .env.example template"
        }
    } else {
        Write-Info "`nMoving ENV files to secure location..."
        foreach ($file in $foundFiles) {
            $sourcePath = Join-Path $ProjectRoot $file
            $destPath = Join-Path $ProjectSecretsPath $file
            
            # Create subdirectory if needed
            $destDir = Split-Path -Parent $destPath
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Success "  Secured: $file"
        }
        
        Write-Info "`nCreating project scripts..."
        
        # Create customized env-manager.ps1
        $scriptPath = Join-Path $ProjectRoot "env-manager.ps1"
        Copy-Item -Path $PSCommandPath -Destination $scriptPath -Force
        
        # Create batch wrapper
        $batchContent = @"
@echo off
REM Environment Variables Manager - Batch Wrapper
REM This makes it easier to run the PowerShell script

powershell.exe -ExecutionPolicy Bypass -File "%~dp0env-manager.ps1" %*
"@
        $batchPath = Join-Path $ProjectRoot "env-manager.bat"
        Set-Content -Path $batchPath -Value $batchContent
        
        Write-Success "Created env-manager scripts in project"
        
        # Update .gitignore
        Update-GitIgnore
        
        Write-Success "`nInitialization complete!"
        Write-Info "ENV files have been moved to: $ProjectSecretsPath"
        Write-Info "Run '.\env-manager.bat clean' to remove them from the project"
        Write-Info "Run '.\env-manager.bat setup' to restore them when needed"
    }
}

# Update .gitignore
function Update-GitIgnore {
    $gitignorePath = Join-Path $ProjectRoot ".gitignore"
    
    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw
        
        $envPatterns = @(
            ".env",
            ".env.*",
            "*.env",
            "!.env.example",
            "!.env.sample"
        )
        
        $needsUpdate = $false
        foreach ($pattern in $envPatterns) {
            if ($gitignoreContent -notmatch [regex]::Escape($pattern)) {
                $needsUpdate = $true
                break
            }
        }
        
        if ($needsUpdate) {
            $envSection = @"

# Environment variables
.env
.env.*
*.env
!.env.example
!.env.sample
"@
            Add-Content -Path $gitignorePath -Value $envSection
            Write-Success "Updated .gitignore with ENV patterns"
        }
    } else {
        # Create new .gitignore
        $gitignoreContent = @"
# Environment variables
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
.next/
"@
        Set-Content -Path $gitignorePath -Value $gitignoreContent
        Write-Success "Created .gitignore with ENV patterns"
    }
}

# Ensure secrets directory exists
function Ensure-SecretsDirectory {
    if (!(Test-Path $ProjectSecretsPath)) {
        Write-Warning "Secrets directory not found. Creating..."
        New-Item -ItemType Directory -Force -Path $ProjectSecretsPath | Out-Null
        New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null
        Write-Success "Created secrets directory at: $ProjectSecretsPath"
        Write-Info "Run 'init' command to scan for ENV files"
    }
}

# Auto-detect ENV files in project
function Get-ProjectEnvFiles {
    $envFiles = @()
    
    # Get all .env files recursively
    $foundFiles = Get-ChildItem -Path $ProjectRoot -Filter ".env*" -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch "\.example$|\.sample$|\.template$" } |
        ForEach-Object {
            $relativePath = $_.FullName.Replace("$ProjectRoot\", "").Replace("$ProjectRoot/", "")
            @{Source="$ProjectSecretsPath\$relativePath"; Dest=$_.FullName; RelPath=$relativePath}
        }
    
    return $foundFiles
}

# Setup function - copies ENV files from secrets to project
function Setup-Environment {
    Write-Info "Setting up environment variables for $ProjectName..."
    Ensure-SecretsDirectory
    
    # Auto-detect or use stored structure
    $envFiles = Get-ProjectEnvFiles
    
    if ($envFiles.Count -eq 0) {
        # Try common locations
        $commonFiles = @(
            @{Source="$ProjectSecretsPath\.env"; Dest="$ProjectRoot\.env"; RelPath=".env"},
            @{Source="$ProjectSecretsPath\.env.local"; Dest="$ProjectRoot\.env.local"; RelPath=".env.local"},
            @{Source="$ProjectSecretsPath\backend\.env"; Dest="$ProjectRoot\backend\.env"; RelPath="backend\.env"},
            @{Source="$ProjectSecretsPath\frontend\.env.local"; Dest="$ProjectRoot\frontend\.env.local"; RelPath="frontend\.env.local"}
        )
        
        foreach ($file in $commonFiles) {
            if (Test-Path $file.Source -PathType Leaf) {
                $envFiles += $file
            }
        }
    }
    
    if ($envFiles.Count -eq 0) {
        Write-Warning "No ENV files found in secrets folder."
        Write-Info "Run '.\env-manager.bat init' to scan and secure existing ENV files"
        return
    }
    
    $copiedCount = 0
    foreach ($file in $envFiles) {
        if (Test-Path $file.Source -PathType Leaf) {
            # Create destination directory if needed
            $destDir = Split-Path -Parent $file.Dest
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            
            Copy-Item -Path $file.Source -Destination $file.Dest -Force
            Write-Success "  [OK] Restored: $($file.RelPath)"
            $copiedCount++
        }
    }
    
    Write-Info "Setup complete! Restored $copiedCount environment files."
}

# Backup function
function Backup-Environment {
    Write-Info "Creating backup of environment files..."
    Ensure-SecretsDirectory
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "$BackupPath\$ProjectName-$timestamp"
    
    # Find all ENV files in project
    $envFiles = Get-ChildItem -Path $ProjectRoot -Filter ".env*" -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch "\.example$|\.sample$|\.template$" }
    
    if ($envFiles.Count -eq 0) {
        Write-Warning "No ENV files found to backup"
        return
    }
    
    $backedUpCount = 0
    foreach ($file in $envFiles) {
        $relativePath = $file.FullName.Replace("$ProjectRoot\", "").Replace("$ProjectRoot/", "")
        $backupPath = "$backupDir\$relativePath"
        $secretPath = "$ProjectSecretsPath\$relativePath"
        
        # Create directories
        $backupDestDir = Split-Path -Parent $backupPath
        if (!(Test-Path $backupDestDir)) {
            New-Item -ItemType Directory -Force -Path $backupDestDir | Out-Null
        }
        
        $secretDestDir = Split-Path -Parent $secretPath
        if (!(Test-Path $secretDestDir)) {
            New-Item -ItemType Directory -Force -Path $secretDestDir | Out-Null
        }
        
        # Copy to backup and secrets
        Copy-Item -Path $file.FullName -Destination $backupPath -Force
        Copy-Item -Path $file.FullName -Destination $secretPath -Force
        
        Write-Success "  [OK] Backed up: $relativePath"
        $backedUpCount++
    }
    
    Write-Success "Backup complete! $backedUpCount files backed up to: $backupDir"
}

# Clean function
function Clean-Environment {
    Write-Info "Cleaning environment files from project..."
    
    # Find all ENV files
    $envFiles = Get-ChildItem -Path $ProjectRoot -Filter ".env*" -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch "\.example$|\.sample$|\.template$" }
    
    if ($envFiles.Count -gt 0) {
        Write-Info "Found $($envFiles.Count) ENV files. Creating backup first..."
        Backup-Environment
        
        # Remove files
        $removedCount = 0
        foreach ($file in $envFiles) {
            $relativePath = $file.FullName.Replace("$ProjectRoot\", "").Replace("$ProjectRoot/", "")
            Remove-Item -Path $file.FullName -Force
            Write-Success "  [OK] Removed: $relativePath"
            $removedCount++
        }
        
        Write-Success "Clean complete! Removed $removedCount environment files."
    } else {
        Write-Info "No ENV files found in project."
    }
    
    Write-Info "Your ENV files are safely stored in: $ProjectSecretsPath"
}

# Status function
function Show-Status {
    Write-Info "Environment Files Status for $ProjectName"
    Write-Info ("=" * 50)
    
    Write-Info "`nProject: $ProjectRoot"
    Write-Info "Secrets: $ProjectSecretsPath"
    
    # Find ENV files in project
    Write-Info "`nProject ENV Files:"
    $projectFiles = Get-ChildItem -Path $ProjectRoot -Filter ".env*" -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch "\.example$|\.sample$|\.template$" }
    
    if ($projectFiles.Count -gt 0) {
        foreach ($file in $projectFiles) {
            $relativePath = $file.FullName.Replace("$ProjectRoot\", "").Replace("$ProjectRoot/", "")
            Write-Success "  [OK] $relativePath ($($file.Length) bytes)"
        }
    } else {
        Write-Warning "  No ENV files in project"
    }
    
    # Find ENV files in secrets
    Write-Info "`nSecured ENV Files:"
    if (Test-Path $ProjectSecretsPath) {
        $secretFiles = Get-ChildItem -Path $ProjectSecretsPath -Filter ".env*" -File -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch "\.example$|\.sample$|\.template$" }
        
        if ($secretFiles.Count -gt 0) {
            foreach ($file in $secretFiles) {
                $relativePath = $file.FullName.Replace("$ProjectSecretsPath\", "").Replace("$ProjectSecretsPath/", "")
                $modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                Write-Success "  [OK] $relativePath - $($file.Length) bytes, modified: $modified"
            }
        } else {
            Write-Warning "  No ENV files in secrets folder"
        }
    } else {
        Write-Warning "  Secrets folder not initialized"
    }
    
    # Show recent backups
    Write-Info "`nRecent Backups:"
    if (Test-Path $BackupPath) {
        $backups = Get-ChildItem -Path $BackupPath -Directory | 
            Where-Object { $_.Name -like "$ProjectName-*" } | 
            Sort-Object Name -Descending | 
            Select-Object -First 5
        
        if ($backups) {
            foreach ($backup in $backups) {
                Write-Info "  - $($backup.Name)"
            }
        } else {
            Write-Warning "  No backups found"
        }
    }
}

# Help function
function Show-Help {
    Write-Info @"
Universal Environment Variables Manager
========================================
Current Project: $ProjectName

This script manages .env files stored securely in your Documents folder.
Secrets location: $ProjectSecretsPath

USAGE:
  .\env-manager.ps1 [command]

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
  2. Run: .\env-manager.ps1 init
  3. Follow the prompts

WORKFLOW:
  1. Clone project from GitHub
  2. Run: .\env-manager.ps1 setup
  3. Work on project normally
  4. Run: .\env-manager.ps1 clean (before deleting)
  
Your ENV files remain safe in: $SecretsRoot
"@
}

# Main execution
switch ($Command) {
    "init"    { Initialize-Project }
    "setup"   { Setup-Environment }
    "backup"  { Backup-Environment }
    "restore" { Setup-Environment }
    "clean"   { Clean-Environment }
    "status"  { Show-Status }
    "help"    { Show-Help }
    default   { Show-Help }
}