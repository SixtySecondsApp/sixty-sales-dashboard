# Script d'installation du bot d'automatisation AI Dev Hub
# Usage: .\install.ps1 <target_directory>

param(
    [string]$TargetDir = "."
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AI Dev Hub Automation Bot Installer  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérifier que nous ne sommes pas déjà dans le répertoire cible
if ((Resolve-Path $ScriptDir).Path -eq (Resolve-Path $TargetDir).Path) {
    Write-Host "❌ Error: Cannot install to the same directory" -ForegroundColor Red
    exit 1
}

# Créer le répertoire automation dans le projet cible
$AutomationDir = Join-Path $TargetDir "automation"
New-Item -ItemType Directory -Path $AutomationDir -Force | Out-Null

Write-Host "→ Copying bot files to $AutomationDir..." -ForegroundColor Yellow

# Copier les fichiers
Copy-Item -Path "$ScriptDir\lib" -Destination $AutomationDir -Recurse -Force
Copy-Item -Path "$ScriptDir\config" -Destination $AutomationDir -Recurse -Force
Copy-Item -Path "$ScriptDir\*.sh" -Destination $AutomationDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\*.ps1" -Destination $AutomationDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ScriptDir\README.md" -Destination $AutomationDir -Force
Copy-Item -Path "$ScriptDir\QUICKSTART.md" -Destination $AutomationDir -Force -ErrorAction SilentlyContinue

# Créer settings.json à partir de l'exemple
$ExampleSettings = Join-Path $AutomationDir "config\settings.example.json"
$Settings = Join-Path $AutomationDir "config\settings.json"

if (Test-Path $ExampleSettings) {
    Copy-Item -Path $ExampleSettings -Destination $Settings -Force
    Write-Host "✓ Created config\settings.json from example" -ForegroundColor Green
}

# Créer le dossier de logs
New-Item -ItemType Directory -Path "$AutomationDir\lib\logs" -Force | Out-Null

Write-Host ""
Write-Host "✓ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. cd $AutomationDir"
Write-Host "  2. Edit config\settings.json with your project details"
Write-Host "  3. Run .\test-mcp-access.ps1 to verify MCP connection"
Write-Host "  4. Run .\ticket-bot.ps1 -Test -TicketId <ID> -DryRun"
Write-Host ""

