# Script pour mettre à jour le bot dans un projet cible
# Usage: .\update-bot.ps1 <target_project_automation_directory>

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetAutomationDir
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $TargetAutomationDir)) {
    Write-Host "❌ Error: Directory does not exist: $TargetAutomationDir" -ForegroundColor Red
    exit 1
}

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   AI Dev Hub Bot Update               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Source: $ScriptDir" -ForegroundColor Gray
Write-Host "Target: $TargetAutomationDir" -ForegroundColor Gray
Write-Host ""

# Backup config
$ConfigFile = Join-Path $TargetAutomationDir "config\settings.json"
$BackupConfig = $null

if (Test-Path $ConfigFile) {
    $BackupConfig = "$env:TEMP\settings-backup-$(Get-Date -Format 'yyyyMMddHHmmss').json"
    Copy-Item -Path $ConfigFile -Destination $BackupConfig
    Write-Host "✓ Config backed up to: $BackupConfig" -ForegroundColor Green
}

# Update files (excluding config)
Write-Host "→ Updating lib files..." -ForegroundColor Yellow
Copy-Item -Path "$ScriptDir\lib\*.sh" -Destination "$TargetAutomationDir\lib\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\lib\*.ps1" -Destination "$TargetAutomationDir\lib\" -Force -ErrorAction SilentlyContinue

Write-Host "→ Updating scripts..." -ForegroundColor Yellow
Copy-Item -Path "$ScriptDir\*.sh" -Destination $TargetAutomationDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\*.ps1" -Destination $TargetAutomationDir -Force -ErrorAction SilentlyContinue

Write-Host "→ Updating documentation..." -ForegroundColor Yellow
Copy-Item -Path "$ScriptDir\README.md" -Destination $TargetAutomationDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\QUICKSTART.md" -Destination $TargetAutomationDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\DEPLOYMENT_GUIDE.md" -Destination $TargetAutomationDir -Force -ErrorAction SilentlyContinue

Write-Host "→ Updating example config..." -ForegroundColor Yellow
Copy-Item -Path "$ScriptDir\config\settings.example.json" -Destination "$TargetAutomationDir\config\" -Force

# Restore config
if ($BackupConfig -and (Test-Path $BackupConfig)) {
    Copy-Item -Path $BackupConfig -Destination $ConfigFile -Force
    Write-Host "✓ Config restored" -ForegroundColor Green
    Remove-Item $BackupConfig -Force
}

Write-Host ""
Write-Host "✓ Update complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Test before committing:" -ForegroundColor Yellow
Write-Host "  cd $TargetAutomationDir"
Write-Host "  .\test-mcp-access.ps1"
Write-Host "  .\ticket-bot.ps1 -Test -TicketId <ID> -DryRun"
Write-Host ""

