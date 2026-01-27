# Task Scheduler configuration script for Windows
# This script creates a scheduled task to automatically run the bot

param(
    [string]$TaskName = "AI-Dev-Hub-Ticket-Bot",
    [int]$IntervalMinutes = 60,
    [string]$ScriptPath = "$PSScriptRoot\ticket-bot.ps1"
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Task Scheduler Configuration         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check for administrator permissions
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script requires administrator permissions" -ForegroundColor Red
    Write-Host "   Please restart PowerShell as administrator" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Administrator permissions verified" -ForegroundColor Green

# Check that the script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ Script not found: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Script found: $ScriptPath" -ForegroundColor Green

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "`n⚠ A task named '$TaskName' already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove it and create a new one? (Y/N)"
    
    if ($response -eq 'Y' -or $response -eq 'y' -or $response -eq 'O' -or $response -eq 'o') {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✓ Previous task removed" -ForegroundColor Green
    } else {
        Write-Host "❌ Setup cancelled" -ForegroundColor Red
        exit 0
    }
}

# Create the task action
Write-Host "`nCreating scheduled task..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`" -Once" `
    -WorkingDirectory (Split-Path $ScriptPath -Parent)

# Create the trigger (every X minutes)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

# Create the task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create the principal (run as current user)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "AI Dev Hub Ticket Automation Bot - Runs every $IntervalMinutes minutes" `
        | Out-Null
    
    Write-Host "`n✓ Scheduled task created successfully!" -ForegroundColor Green
    Write-Host "`nDetails:" -ForegroundColor Cyan
    Write-Host "  Name: $TaskName" -ForegroundColor White
    Write-Host "  Frequency: Every $IntervalMinutes minutes" -ForegroundColor White
    Write-Host "  Script: $ScriptPath" -ForegroundColor White
    Write-Host "  User: $env:USERNAME" -ForegroundColor White
    
    Write-Host "`nUseful commands:" -ForegroundColor Cyan
    Write-Host "  View task:       Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  Start task:      Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  Stop task:       Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  Remove task:     Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
    
    Write-Host "`n📝 Logs will be available in: $PSScriptRoot\logs\" -ForegroundColor Yellow
    
    # Offer to start the task now
    Write-Host ""
    $startNow = Read-Host "Do you want to start the task now? (Y/N)"
    
    if ($startNow -eq 'Y' -or $startNow -eq 'y' -or $startNow -eq 'O' -or $startNow -eq 'o') {
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "✓ Task started!" -ForegroundColor Green
        Write-Host "  Check the logs in a few moments" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "`n❌ Error while creating the task: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

