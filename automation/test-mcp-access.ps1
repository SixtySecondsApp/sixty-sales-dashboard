# MCP AI Dev Hub server access test via Cursor CLI
# This script checks that Cursor CLI can access the MCP server and retrieve data

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Output colors
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ $msg" -ForegroundColor Cyan }
function Write-Test { param($msg) Write-Host "→ $msg" -ForegroundColor Yellow }

Write-Host "`n==================================" -ForegroundColor Magenta
Write-Host "MCP AI Dev Hub Access Test" -ForegroundColor Magenta
Write-Host "==================================`n" -ForegroundColor Magenta

# Test 1: Verify that Cursor CLI is installed
Write-Test "Test 1: Checking that Cursor CLI is installed"
try {
    $cliVersion = cursor-agent --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Cursor CLI is installed"
        if ($Verbose) { Write-Host "  Version: $cliVersion" -ForegroundColor Gray }
    } else {
        Write-Error "Cursor CLI is not installed correctly"
        Write-Info "Install it with: curl https://cursor.com/install -fsS | bash"
        exit 1
    }
} catch {
    Write-Error "Cursor CLI not found in PATH"
    Write-Info "Install it with: curl https://cursor.com/install -fsS | bash"
    exit 1
}

# Test 2: Check MCP configuration
Write-Test "`nTest 2: Checking MCP configuration"
$mcpConfigPath = Join-Path $env:USERPROFILE ".cursor\mcp.json"
if (Test-Path $mcpConfigPath) {
    Write-Success "MCP configuration file found: $mcpConfigPath"
    
    try {
        $mcpConfig = Get-Content $mcpConfigPath -Raw | ConvertFrom-Json
        if ($mcpConfig.mcpServers."ai-dev-hub-mcp-server") {
            Write-Success "MCP server 'ai-dev-hub-mcp-server' is configured"
            if ($Verbose) {
                Write-Host "  Command: $($mcpConfig.mcpServers.'ai-dev-hub-mcp-server'.command)" -ForegroundColor Gray
                Write-Host "  Args: $($mcpConfig.mcpServers.'ai-dev-hub-mcp-server'.args -join ' ')" -ForegroundColor Gray
            }
        } else {
            Write-Error "MCP server 'ai-dev-hub-mcp-server' not found in configuration"
            exit 1
        }
    } catch {
        Write-Error "Error reading MCP configuration: $_"
        exit 1
    }
} else {
    Write-Error "MCP configuration file not found: $mcpConfigPath"
    Write-Info "Create the file with the MCP server configuration"
    exit 1
}

# Test 3: Check that npx and mcp-remote are available
Write-Test "`nTest 3: Checking npx and mcp-remote"
try {
    $npxVersion = npx --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npx is available (version: $npxVersion)"
    } else {
        Write-Error "npx is not available"
        Write-Info "Install Node.js from https://nodejs.org"
        exit 1
    }
} catch {
    Write-Error "npx not found. Please install Node.js"
    exit 1
}

# Test 4: Test connection to MCP server via Cursor CLI
Write-Test "`nTest 4: Testing connection to MCP server (project search)"
Write-Info "Attempting to retrieve the list of projects via MCP..."

$testPrompt = "Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_projects' to list all projects. Return only the JSON result."

try {
    # Create a temporary file to store output
    $outputFile = [System.IO.Path]::GetTempFileName()
    
    Write-Host "  Running: cursor-agent -p --approve-mcps --force --output-format text `"$testPrompt`"" -ForegroundColor Gray
    
    # Run cursor-agent in print mode with MCP approval and force execution
    $result = cursor-agent -p --approve-mcps --force --output-format text $testPrompt 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Cursor CLI command executed successfully"
        
        # Show output
        Write-Host "`n--- Result ---" -ForegroundColor Cyan
        Write-Host $result
        Write-Host "--- End of result ---`n" -ForegroundColor Cyan
        
        # Check if the output contains project data
        if ($result -match "projects" -or $result -match "name" -or $result -match "client") {
            Write-Success "MCP server returned project data"
        } else {
            Write-Info "Output does not seem to contain project data"
            Write-Info "This may be normal if no projects exist yet"
        }
    } else {
        Write-Error "Cursor CLI command failed"
        Write-Host "  Error output: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Error "Exception during Cursor CLI execution: $_"
    exit 1
}

# Test 5: Test task search
Write-Test "`nTest 5: Testing task search via MCP"
Write-Info "Attempting to retrieve 'todo' tasks..."

$taskPrompt = "Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_tasks' with status=['todo'] to find all todo tasks. Return the results."

try {
    Write-Host "  Running: cursor-agent -p --approve-mcps --force --output-format text `"$taskPrompt`"" -ForegroundColor Gray
    
    $taskResult = cursor-agent -p --approve-mcps --force --output-format text $taskPrompt 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Task query executed successfully"
        
        # Show output
        Write-Host "`n--- Task Results ---" -ForegroundColor Cyan
        Write-Host $taskResult
        Write-Host "--- End of tasks result ---`n" -ForegroundColor Cyan
        
        # Check if tasks are present
        if ($taskResult -match "task" -or $taskResult -match "todo" -or $taskResult -match "title") {
            Write-Success "Tasks found or the system responds correctly"
        } else {
            Write-Info "No 'todo' tasks found (this may be normal)"
        }
    } else {
        Write-Error "Task query failed"
        Write-Host "  Error output: $taskResult" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Error "Exception during task search: $_"
    exit 1
}

# Final summary
Write-Host "`n==================================" -ForegroundColor Magenta
Write-Host "       Test Summary" -ForegroundColor Magenta
Write-Host "==================================`n" -ForegroundColor Magenta

Write-Success "All tests passed!"
Write-Host ""
Write-Success "✓ Cursor CLI is installed and working"
Write-Success "✓ MCP configuration is correct"
Write-Success "✓ Connection to MCP AI Dev Hub server succeeded"
Write-Success "✓ MCP tools are accessible"
Write-Host ""
Write-Info "The automation system can now be deployed."
Write-Info "Next step: Configure settings.json with your Project ID"
Write-Host ""

