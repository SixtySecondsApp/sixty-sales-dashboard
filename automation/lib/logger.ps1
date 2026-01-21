# Logging module for the automation system
# Provides logging functions with different levels and file rotation

$script:LogDirectory = Join-Path $PSScriptRoot "..\logs"
$script:LogLevel = "INFO"
$script:LogToConsole = $true
$script:CurrentLogFile = $null

# Initialize the logging system
function Initialize-Logger {
    param(
        [string]$LogDir = (Join-Path $PSScriptRoot "..\logs"),
        [ValidateSet("DEBUG", "INFO", "WARN", "ERROR")]
        [string]$Level = "INFO",
        [bool]$ToConsole = $true
    )
    
    $script:LogDirectory = $LogDir
    $script:LogLevel = $Level
    $script:LogToConsole = $ToConsole
    
    # Create the log folder if it does not exist
    if (-not (Test-Path $LogDirectory)) {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    }
    
    # Set today's log file
    $dateString = Get-Date -Format "yyyy-MM-dd"
    $script:CurrentLogFile = Join-Path $LogDirectory "ticket-bot-$dateString.log"
    
    Write-LogMessage "INFO" "Logging system initialized"
    Write-LogMessage "INFO" "Log level: $Level"
    Write-LogMessage "INFO" "Log file: $CurrentLogFile"
}

# Get the priority for a log level
function Get-LogLevelPriority {
    param([string]$Level)
    
    switch ($Level) {
        "DEBUG" { return 0 }
        "INFO"  { return 1 }
        "WARN"  { return 2 }
        "ERROR" { return 3 }
        default { return 1 }
    }
}

# Write a log message
function Write-LogMessage {
    param(
        [ValidateSet("DEBUG", "INFO", "WARN", "ERROR")]
        [string]$Level,
        [string]$Message,
        [hashtable]$Context = @{}
    )
    
    # Check log level
    $currentPriority = Get-LogLevelPriority $script:LogLevel
    $messagePriority = Get-LogLevelPriority $Level
    
    if ($messagePriority -lt $currentPriority) {
        return
    }
    
    # Format the message
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    
    # Add context if present
    if ($Context.Count -gt 0) {
        $contextJson = $Context | ConvertTo-Json -Compress
        $logLine += " | Context: $contextJson"
    }
    
    # Write to file
    if ($script:CurrentLogFile) {
        Add-Content -Path $script:CurrentLogFile -Value $logLine -Encoding UTF8
    }
    
    # Write to console if enabled
    if ($script:LogToConsole) {
        $color = switch ($Level) {
            "DEBUG" { "Gray" }
            "INFO"  { "White" }
            "WARN"  { "Yellow" }
            "ERROR" { "Red" }
            default { "White" }
        }
        Write-Host $logLine -ForegroundColor $color
    }
}

# Convenience functions
function Write-DebugLog {
    param([string]$Message, [hashtable]$Context = @{})
    Write-LogMessage "DEBUG" $Message $Context
}

function Write-InfoLog {
    param([string]$Message, [hashtable]$Context = @{})
    Write-LogMessage "INFO" $Message $Context
}

function Write-WarnLog {
    param([string]$Message, [hashtable]$Context = @{})
    Write-LogMessage "WARN" $Message $Context
}

function Write-ErrorLog {
    param([string]$Message, [hashtable]$Context = @{})
    Write-LogMessage "ERROR" $Message $Context
}

# Clean up old log files
function Clear-OldLogs {
    param(
        [int]$DaysToKeep = 30
    )
    
    $cutoffDate = (Get-Date).AddDays(-$DaysToKeep)
    
    Get-ChildItem -Path $script:LogDirectory -Filter "ticket-bot-*.log" | 
        Where-Object { $_.LastWriteTime -lt $cutoffDate } |
        ForEach-Object {
            Write-InfoLog "Deleting old log file: $($_.Name)"
            Remove-Item $_.FullName -Force
        }
}

# Export functions
Export-ModuleMember -Function @(
    'Initialize-Logger',
    'Write-LogMessage',
    'Write-DebugLog',
    'Write-InfoLog',
    'Write-WarnLog',
    'Write-ErrorLog',
    'Clear-OldLogs'
)

