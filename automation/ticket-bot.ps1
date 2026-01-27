# AI Dev Hub Ticket Automation Bot
# This script automatically processes "todo" tickets using Cursor CLI

param(
    [string]$ConfigFile = "$PSScriptRoot\config\settings.json",
    [switch]$TestMode,
    [string]$TicketId,
    [switch]$DryRun,
    [switch]$Once,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Load modules
. "$PSScriptRoot\lib\logger.ps1"
. "$PSScriptRoot\lib\mcp-client.ps1"
. "$PSScriptRoot\lib\git-operations.ps1"

# Load configuration
function Load-Configuration {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Host "Configuration file not found: $Path" -ForegroundColor Red
        exit 1
    }
    
    try {
        $config = Get-Content $Path -Raw | ConvertFrom-Json
        
        # Validate required fields
        if ([string]::IsNullOrEmpty($config.projectId)) {
            Write-Host "ERROR: projectId is not configured in settings.json" -ForegroundColor Red
            exit 1
        }
        
        return $config
    } catch {
        Write-Host "Error loading configuration: $_" -ForegroundColor Red
        exit 1
    }
}

# Process a ticket
function Process-Ticket {
    param(
        [object]$Task,
        [object]$Config
    )
    
    Write-InfoLog "========================================" 
    Write-InfoLog "Processing ticket: $($Task.title)" @{
        TaskId = $Task.id
        Priority = $Task.priority
    }
    Write-InfoLog "========================================" 
    
    $taskId = $Task.id
    $startTime = Get-Date
    
    try {
        # 1. Update main branch
        Write-InfoLog "Step 1/7: Updating main branch"
        if (-not (Update-MainBranch -MainBranch $Config.repository.defaultBranch -Remote $Config.repository.remote)) {
            throw "Failed to update main branch"
        }
        
        # 2. Create a branch for the ticket
        Write-InfoLog "Step 2/7: Creating branch"
        $branchName = New-TicketBranch -TaskId $taskId -BranchPrefix $Config.git.branchPrefix
        if (-not $branchName) {
            throw "Failed to create branch"
        }
        
        # 3. Get full ticket details
        Write-InfoLog "Step 3/7: Retrieving ticket details"
        $taskDetails = Get-TaskDetails -TaskId $taskId
        if (-not $taskDetails) {
            throw "Unable to retrieve ticket details"
        }
        
        # 4. Use Cursor CLI to implement the ticket
        Write-InfoLog "Step 4/7: Implementation via Cursor CLI"
        
        $implementationPrompt = @"
You are implementing a task for the AI Dev Hub project.

Task ID: $taskId
Task Title: $($taskDetails.title)
Task Description: $($taskDetails.description)
Task Priority: $($taskDetails.priority)
Task Type: $($taskDetails.type)

Please:
1. Analyze the codebase to understand where changes are needed
2. Implement the required changes following best practices
3. Ensure the code is well-documented
4. Make sure all changes are complete and functional

Implement this task now. Make all necessary file changes.
"@
        
        if ($DryRun) {
            Write-InfoLog "[DRY RUN] Simulating implementation via Cursor CLI"
            Write-Host "Prompt that would be sent:" -ForegroundColor Cyan
            Write-Host $implementationPrompt -ForegroundColor Gray
        } else {
            $implResult = Invoke-CursorCLI -Prompt $implementationPrompt -Model $Config.cli.model -TimeoutSeconds $Config.cli.timeout
            
            if (-not $implResult.Success) {
                throw "Implementation failed: $($implResult.Error)"
            }
            
            Write-InfoLog "Implementation complete"
        }
        
        # 5. Commit changes
        Write-InfoLog "Step 5/7: Committing changes"
        
        $commitMessage = $Config.git.commitMessageTemplate `
            -replace '\{title\}', $taskDetails.title `
            -replace '\{description\}', ($taskDetails.description -replace "`n", " " | Select-Object -First 100) `
            -replace '\{ticketCode\}', $taskId
        
        if ($DryRun) {
            Write-InfoLog "[DRY RUN] Simulating commit"
            Write-Host "Commit message:" -ForegroundColor Cyan
            Write-Host $commitMessage -ForegroundColor Gray
        } else {
            if (-not (Save-Changes -Message $commitMessage -AuthorName $Config.git.authorName -AuthorEmail $Config.git.authorEmail)) {
                throw "Failed to commit"
            }
        }
        
        # 6. Push and create PR
        Write-InfoLog "Step 6/7: Pushing and creating Pull Request"
        
        if ($DryRun) {
            Write-InfoLog "[DRY RUN] Simulating push and PR creation"
        } else {
            if (-not (Push-Branch -BranchName $branchName -Remote $Config.repository.remote)) {
                throw "Failed to push"
            }
            
            $prTitle = "✨ $($taskDetails.title)"
            $prBody = @"
## Description
$($taskDetails.description)

## Type
$($taskDetails.type)

## Priority
$($taskDetails.priority)

---
Closes #$taskId
🤖 Automatically generated by the automation bot
"@
            
            $prUrl = New-PullRequest -Title $prTitle -Body $prBody -BaseBranch $Config.repository.defaultBranch
            
            if (-not $prUrl) {
                Write-WarnLog "PR could not be created, but code was pushed"
            } else {
                Write-InfoLog "Pull Request created: $prUrl"
                
                # Add a comment on the ticket with the PR link
                $comment = "🤖 Pull Request automatically created: $prUrl"
                Add-TaskComment -TaskId $taskId -Comment $comment | Out-Null
            }
        }
        
        # 7. Update ticket status
        Write-InfoLog "Step 7/7: Updating ticket status"
        
        if ($DryRun) {
            Write-InfoLog "[DRY RUN] Simulating status update to 'in review'"
        } else {
            if (-not (Update-TaskStatus -TaskId $taskId -NewStatus "in review")) {
                Write-WarnLog "Unable to update ticket status"
            }
        }
        
        # Switch back to main branch
        Update-MainBranch -MainBranch $Config.repository.defaultBranch -Remote $Config.repository.remote | Out-Null
        
        $duration = (Get-Date) - $startTime
        Write-InfoLog "Ticket successfully processed in $($duration.TotalMinutes.ToString('F2')) minutes" @{
            TaskId = $taskId
            Duration = $duration.ToString()
        }
        
        return $true
        
    } catch {
        Write-ErrorLog "Error while processing ticket: $_" @{
            TaskId = $taskId
            Error = $_.Exception.Message
        }
        
        # Cleanup in case of error
        Reset-ToMainBranch -MainBranch $Config.repository.defaultBranch | Out-Null
        
        # Add an error comment to the ticket
        if (-not $DryRun) {
            $errorComment = "🤖 Error during automatic processing: $_`n`nManual intervention required."
            Add-TaskComment -TaskId $taskId -Comment $errorComment | Out-Null
        }
        
        return $false
    }
}

# Main loop
function Start-Bot {
    param([object]$Config)
    
    Write-InfoLog "Starting ticket automation bot"
    Write-InfoLog "Project: $($Config.projectName) ($($Config.projectId))"
    Write-InfoLog "Interval: $($Config.intervalMinutes) minutes"
    Write-InfoLog "Mode: $(if ($DryRun) { 'DRY RUN' } else { 'PRODUCTION' })"
    
    # Preliminary checks
    Write-InfoLog "Performing preliminary checks..."
    
    if (-not (Test-GitConfiguration)) {
        Write-ErrorLog "Invalid Git configuration"
        exit 1
    }
    
    if (-not (Test-GitHubCLI)) {
        Write-WarnLog "GitHub CLI not configured - PRs cannot be created automatically"
    }
    
    Write-InfoLog "All checks passed"
    
    do {
        $iterationStart = Get-Date
        Write-InfoLog "`n========================================" 
        Write-InfoLog "New iteration: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-InfoLog "========================================" 
        
        try {
            # Retrieve "todo" tickets
            Write-InfoLog "Looking for 'todo' tickets..."
            $tasks = Get-TodoTasks -ProjectId $Config.projectId -Limit $Config.maxTicketsPerRun
            
            if ($tasks.Count -eq 0) {
                Write-InfoLog "No 'todo' tickets found"
            } else {
                Write-InfoLog "Found $($tasks.Count) ticket(s) to process"
                
                $successCount = 0
                $failureCount = 0
                
                foreach ($task in $tasks) {
                    if (Process-Ticket -Task $task -Config $Config) {
                        $successCount++
                    } else {
                        $failureCount++
                    }
                }
                
                Write-InfoLog "Summary: $successCount successes, $failureCount failures"
            }
            
            # Clean old logs
            Clear-OldLogs -DaysToKeep $Config.logging.maxLogFiles
            
        } catch {
            Write-ErrorLog "Error in main loop: $_"
        }
        
        # Wait before next iteration
        if (-not $Once) {
            $nextRun = $iterationStart.AddMinutes($Config.intervalMinutes)
            $waitSeconds = ($nextRun - (Get-Date)).TotalSeconds
            
            if ($waitSeconds -gt 0) {
                Write-InfoLog "Next run at: $($nextRun.ToString('yyyy-MM-dd HH:mm:ss'))"
                Write-InfoLog "Waiting $([Math]::Round($waitSeconds/60, 1)) minutes..."
                Start-Sleep -Seconds $waitSeconds
            }
        }
        
    } while (-not $Once)
    
    Write-InfoLog "Bot stopped"
}

# Main entry point
function Main {
    Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  AI Dev Hub Automation Bot            ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan
    
    # Load configuration
    $config = Load-Configuration -Path $ConfigFile
    
    # Initialize logger
    $logLevel = if ($Verbose) { "DEBUG" } else { $config.logging.level }
    Initialize-Logger -Level $logLevel -ToConsole $config.logging.logToConsole
    
    # Test mode: process a single ticket
    if ($TestMode) {
        if (-not $TicketId) {
            Write-Host "Test mode requires -TicketId" -ForegroundColor Red
            exit 1
        }
        
        Write-InfoLog "TEST MODE: Processing ticket $TicketId"
        $task = Get-TaskDetails -TaskId $TicketId
        if ($task) {
            Process-Ticket -Task $task -Config $config
        } else {
            Write-ErrorLog "Ticket not found: $TicketId"
        }
        return
    }
    
    # Start the bot
    Start-Bot -Config $config
}

# Execute
Main

