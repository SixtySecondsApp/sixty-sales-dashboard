# Git Operations module for ticket automation
# Provides functions to create branches, commit, and create PRs

. "$PSScriptRoot\logger.ps1"

# Check that Git is properly configured
function Test-GitConfiguration {
    Write-DebugLog "Checking Git configuration"
    
    # Check that git is available
    try {
        $gitVersion = git --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "Git is not installed or not in PATH"
            return $false
        }
        Write-DebugLog "Git version: $gitVersion"
    } catch {
        Write-ErrorLog "Error while checking Git: $_"
        return $false
    }
    
    # Check user configuration
    $userName = git config user.name 2>&1
    $userEmail = git config user.email 2>&1
    
    if ([string]::IsNullOrEmpty($userName) -or [string]::IsNullOrEmpty($userEmail)) {
        Write-WarnLog "Incomplete Git configuration (missing user.name or user.email)"
        return $false
    }
    
    Write-DebugLog "Git configured for: $userName <$userEmail>"
    return $true
}

# Check that GitHub CLI is set up
function Test-GitHubCLI {
    Write-DebugLog "Checking GitHub CLI"
    
    try {
        $ghVersion = gh --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-WarnLog "GitHub CLI (gh) is not installed"
            return $false
        }
        Write-DebugLog "GitHub CLI version: $ghVersion"
        
        # Check authentication
        $authStatus = gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-WarnLog "GitHub CLI is not authenticated. Run: gh auth login"
            return $false
        }
        
        Write-DebugLog "GitHub CLI successfully authenticated"
        return $true
    } catch {
        Write-WarnLog "Error while checking GitHub CLI: $_"
        return $false
    }
}

# Ensure we are on the main branch and it's up to date
function Update-MainBranch {
    param(
        [string]$MainBranch = "main",
        [string]$Remote = "origin"
    )
    
    Write-InfoLog "Updating main branch: $MainBranch"
    
    try {
        # Fetch the latest changes
        Write-DebugLog "Running: git fetch $Remote"
        git fetch $Remote 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git fetch failed"
            return $false
        }
        
        # Checkout main branch
        Write-DebugLog "Running: git checkout $MainBranch"
        git checkout $MainBranch 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git checkout $MainBranch failed"
            return $false
        }
        
        # Pull latest changes
        Write-DebugLog "Running: git pull $Remote $MainBranch"
        git pull $Remote $MainBranch 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git pull failed"
            return $false
        }
        
        Write-InfoLog "Main branch updated successfully"
        return $true
        
    } catch {
        Write-ErrorLog "Error while updating the main branch: $_"
        return $false
    }
}

# Create a new branch for a ticket
function New-TicketBranch {
    param(
        [string]$TaskId,
        [string]$BranchPrefix = "auto/ticket-"
    )
    
    $branchName = "$BranchPrefix$TaskId"
    Write-InfoLog "Creating branch: $branchName"
    
    try {
        # Check if branch exists locally
        $existingBranch = git branch --list $branchName 2>&1
        if ($existingBranch) {
            Write-WarnLog "Branch $branchName already exists locally. Deleting..."
            git branch -D $branchName 2>&1 | Out-Null
        }
        
        # Create new branch
        Write-DebugLog "Running: git checkout -b $branchName"
        git checkout -b $branchName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "Failed to create branch"
            return $null
        }
        
        Write-InfoLog "Branch created successfully: $branchName"
        return $branchName
        
    } catch {
        Write-ErrorLog "Error while creating branch: $_"
        return $null
    }
}

# Commit all changes
function Save-Changes {
    param(
        [string]$Message,
        [string]$AuthorName = $null,
        [string]$AuthorEmail = $null
    )
    
    Write-InfoLog "Committing changes"
    
    try {
        # Add all files
        Write-DebugLog "Running: git add -A"
        git add -A 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git add failed"
            return $false
        }
        
        # Check if there are changes to commit
        $status = git status --porcelain 2>&1
        if ([string]::IsNullOrEmpty($status)) {
            Write-WarnLog "No changes to commit"
            return $true
        }
        
        # Commit with specific author if provided
        if ($AuthorName -and $AuthorEmail) {
            Write-DebugLog "Commit with author: $AuthorName <$AuthorEmail>"
            git -c "user.name=$AuthorName" -c "user.email=$AuthorEmail" commit -m $Message 2>&1 | Out-Null
        } else {
            Write-DebugLog "Running: git commit -m '$Message'"
            git commit -m $Message 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git commit failed"
            return $false
        }
        
        Write-InfoLog "Changes committed successfully"
        return $true
        
    } catch {
        Write-ErrorLog "Error during commit: $_"
        return $false
    }
}

# Push the branch to the remote
function Push-Branch {
    param(
        [string]$BranchName,
        [string]$Remote = "origin"
    )
    
    Write-InfoLog "Pushing branch: $BranchName to $Remote"
    
    try {
        Write-DebugLog "Running: git push -u $Remote $BranchName"
        git push -u $Remote $BranchName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "git push failed"
            return $false
        }
        
        Write-InfoLog "Branch pushed successfully"
        return $true
        
    } catch {
        Write-ErrorLog "Error during push: $_"
        return $false
    }
}

# Create a Pull Request with GitHub CLI
function New-PullRequest {
    param(
        [string]$Title,
        [string]$Body,
        [string]$BaseBranch = "main"
    )
    
    Write-InfoLog "Creating Pull Request: $Title"
    
    try {
        # Create PR
        Write-DebugLog "Running: gh pr create --title '$Title' --body '$Body' --base $BaseBranch"
        $prUrl = gh pr create --title $Title --body $Body --base $BaseBranch 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "Failed to create PR"
            Write-DebugLog "Error: $prUrl"
            return $null
        }
        
        Write-InfoLog "Pull Request created: $prUrl"
        return $prUrl
        
    } catch {
        Write-ErrorLog "Error while creating PR: $_"
        return $null
    }
}

# Cleanup on error (switch back to main)
function Reset-ToMainBranch {
    param(
        [string]$MainBranch = "main"
    )
    
    Write-WarnLog "Cleanup: switching back to branch $MainBranch"
    
    try {
        # Discard all changes
        git reset --hard 2>&1 | Out-Null
        git clean -fd 2>&1 | Out-Null
        
        # Switch back to main
        git checkout $MainBranch 2>&1 | Out-Null
        
        Write-InfoLog "Cleanup done"
        return $true
    } catch {
        Write-ErrorLog "Error during cleanup: $_"
        return $false
    }
}

# Export functions
Export-ModuleMember -Function @(
    'Test-GitConfiguration',
    'Test-GitHubCLI',
    'Update-MainBranch',
    'New-TicketBranch',
    'Save-Changes',
    'Push-Branch',
    'New-PullRequest',
    'Reset-ToMainBranch'
)
