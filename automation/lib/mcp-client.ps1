# MCP client module for interacting with AI Dev Hub via Cursor CLI
# Provides functions to retrieve and update tasks

. "$PSScriptRoot\logger.ps1"

# Execute a Cursor CLI command with retry
function Invoke-CursorCLI {
    param(
        [string]$Prompt,
        [string]$Model = "claude-sonnet-4",
        [string]$OutputFormat = "text",
        [int]$MaxRetries = 3,
        [int]$TimeoutSeconds = 300
    )
    
    $attempt = 0
    $lastError = $null
    
    while ($attempt -lt $MaxRetries) {
        $attempt++
        
        try {
            Write-DebugLog "Attempt ${attempt}/${MaxRetries}: Executing cursor-agent" @{
                Prompt = $Prompt.Substring(0, [Math]::Min(100, $Prompt.Length))
                Model = $Model
            }
            
            # Create a temporary file for output
            $outputFile = [System.IO.Path]::GetTempFileName()
            
            # Execute cursor-agent with timeout, MCP approval, and force execution
            $job = Start-Job -ScriptBlock {
                param($p, $m, $of)
                cursor-agent -p --approve-mcps --force --model $m --output-format $of $p 2>&1
            } -ArgumentList $Prompt, $Model, $OutputFormat
            
            # Wait with timeout
            $completed = Wait-Job -Job $job -Timeout $TimeoutSeconds
            
            if ($completed) {
                $result = Receive-Job -Job $job
                $exitCode = if ($job.State -eq "Completed") { 0 } else { 1 }
                Remove-Job -Job $job -Force
                
                if ($exitCode -eq 0) {
                    Write-DebugLog "cursor-agent command succeeded"
                    return @{
                        Success = $true
                        Output = $result
                        Error = $null
                    }
                } else {
                    $lastError = "Command failed with exit code $exitCode"
                    Write-WarnLog "Attempt $attempt failed: $lastError"
                }
            } else {
                # Timeout
                Stop-Job -Job $job
                Remove-Job -Job $job -Force
                $lastError = "Timeout after $TimeoutSeconds seconds"
                Write-WarnLog "Attempt $attempt timeout: $lastError"
            }
            
        } catch {
            $lastError = $_.Exception.Message
            Write-WarnLog "Attempt $attempt exception: $lastError"
        }
        
        # Wait before retrying (except for the last attempt)
        if ($attempt -lt $MaxRetries) {
            $waitSeconds = $attempt * 2
            Write-DebugLog "Waiting $waitSeconds seconds before retry"
            Start-Sleep -Seconds $waitSeconds
        }
    }
    
    # All attempts failed
    Write-ErrorLog "Failed after $MaxRetries attempts" @{ LastError = $lastError }
    return @{
        Success = $false
        Output = $null
        Error = $lastError
    }
}

# Retrieve "todo" tasks for a project
function Get-TodoTasks {
    param(
        [string]$ProjectId,
        [int]$Limit = 10
    )
    
    Write-InfoLog "Retrieving 'todo' tasks for project $ProjectId"
    
    $prompt = @"
Use the MCP tool 'mcp_ai-dev-hub-mcp-server_search_tasks' to search for tasks with the following parameters:
- projectId: "$ProjectId"
- status: ["todo"]
- limit: $Limit

Return ONLY a valid JSON array of tasks with their id, title, description, priority, and dueDate fields.
Do not include any explanatory text, only the JSON array.
"@
    
    $result = Invoke-CursorCLI -Prompt $prompt -OutputFormat "text"
    
    if (-not $result.Success) {
        Write-ErrorLog "Unable to retrieve tasks" @{ Error = $result.Error }
        return @()
    }
    
    # Parse the JSON
    try {
        # Extract the JSON from the output (may contain text before/after)
        $jsonMatch = $result.Output -match '\[[\s\S]*\]'
        if ($jsonMatch) {
            $jsonText = $Matches[0]
            $tasks = $jsonText | ConvertFrom-Json
            Write-InfoLog "Retrieved $($tasks.Count) 'todo' task(s)"
            return $tasks
        } else {
            Write-WarnLog "No JSON found in output"
            Write-DebugLog "Raw output: $($result.Output)"
            return @()
        }
    } catch {
        Write-ErrorLog "Error when parsing JSON" @{ Error = $_.Exception.Message }
        Write-DebugLog "Raw output: $($result.Output)"
        return @()
    }
}

# Retrieve the details of a task
function Get-TaskDetails {
    param(
        [string]$TaskId
    )
    
    Write-InfoLog "Retrieving details for task $TaskId"
    
    $prompt = "Execute the MCP tool 'get_task' from ai-dev-hub-mcp-server with taskId=`"$TaskId`"."
    
    $result = Invoke-CursorCLI -Prompt $prompt -OutputFormat "text"
    
    if (-not $result.Success) {
        Write-ErrorLog "Unable to retrieve task details" @{ TaskId = $TaskId; Error = $result.Error }
        return $null
    }
    
    Write-DebugLog "Raw output from get_task: $($result.Output)"
    
    # Cursor CLI returns formatted text, so we need to parse it
    try {
        $output = $result.Output
        
        # Extract key information from formatted output
        if ($output -match 'ID\s*:\s*([a-f0-9\-]+)') { $id = $Matches[1].Trim() } else { $id = "" }
        if ($output -match '\*\*([^*]+)\*\*\s*\[TSK') { $title = $Matches[1].Trim() } else { $title = "" }
        if ($output -match 'Statut\s*:\s*([^\r\n]+)') { $status = $Matches[1].Trim() } else { $status = "" }
        if ($output -match 'Priorité\s*:\s*([^\r\n]+)') { $priority = $Matches[1].Trim() } else { $priority = "" }
        if ($output -match 'Type\s*:\s*([^\r\n]+)') { $type = $Matches[1].Trim() } else { $type = "" }
        
        # Extract description (between **Description :** and **Timeline :**)
        if ($output -match '\*\*Description\s*:\*\*([\s\S]*?)\*\*Timeline\s*:\*\*') {
            $description = $Matches[1].Trim()
        } else {
            $description = ""
        }
        
        # Build task object
        if ($id -and $title) {
            $task = [PSCustomObject]@{
                id = $id
                title = $title
                description = $description
                status = $status
                priority = $priority
                type = $type
            }
            
            Write-InfoLog "Details retrieved for task: $title"
            return $task
        } else {
            Write-ErrorLog "Could not extract task details from formatted output"
            Write-DebugLog "Extracted - id: '$id', title: '$title'"
            return $null
        }
    } catch {
        Write-ErrorLog "Error parsing task details" @{ Error = $_.Exception.Message }
        Write-DebugLog "Raw output: $($result.Output)"
        return $null
    }
}

# Update a task's status
function Update-TaskStatus {
    param(
        [string]$TaskId,
        [ValidateSet("backlog", "todo", "in progress", "in review", "done", "cancelled")]
        [string]$NewStatus
    )
    
    Write-InfoLog "Updating task $TaskId status to '$NewStatus'"
    
    $prompt = @"
Use the MCP tool 'mcp_ai-dev-hub-mcp-server_update_task' with:
- taskId: "$TaskId"
- status: "$NewStatus"

Confirm the update was successful.
"@
    
    $result = Invoke-CursorCLI -Prompt $prompt -OutputFormat "text"
    
    if (-not $result.Success) {
        Write-ErrorLog "Unable to update task status" @{ TaskId = $TaskId; Error = $result.Error }
        return $false
    }
    
    Write-InfoLog "Task status successfully updated"
    return $true
}

# Create a comment on a task
function Add-TaskComment {
    param(
        [string]$TaskId,
        [string]$Comment
    )
    
    Write-InfoLog "Adding a comment to task $TaskId"
    
    # Escape double quotes in the comment
    $escapedComment = $Comment -replace '"', '\"'
    
    $prompt = @"
Use the MCP tool 'mcp_ai-dev-hub-mcp-server_create_comment' with:
- taskId: "$TaskId"
- content: "$escapedComment"

Confirm the comment was added successfully.
"@
    
    $result = Invoke-CursorCLI -Prompt $prompt -OutputFormat "text"
    
    if (-not $result.Success) {
        Write-ErrorLog "Unable to add comment" @{ TaskId = $TaskId; Error = $result.Error }
        return $false
    }
    
    Write-InfoLog "Comment added successfully"
    return $true
}

# Export the functions
Export-ModuleMember -Function @(
    'Invoke-CursorCLI',
    'Get-TodoTasks',
    'Get-TaskDetails',
    'Update-TaskStatus',
    'Add-TaskComment'
)

