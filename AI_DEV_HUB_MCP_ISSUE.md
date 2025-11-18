# AI Dev Hub MCP Server Issue Report

## Problem
The AI Dev Hub MCP server is experiencing errors when trying to search for projects:

```
Error: Cannot read properties of undefined (reading 'length')
```

## Status
- ❌ `search_projects` - Fails with undefined length error
- ✅ `search_clients` - Works correctly
- ✅ `get_client` - Works correctly
- ❌ `search_users` - Fails with "Invalid request: Invalid parameters" when query is empty
- ❌ `create_project` - Requires valid managerId (needs user search to work first)

## Root Cause
The `search_projects` function appears to have a bug where it tries to access `.length` on an undefined value. This likely happens when:
1. There are no projects in the system
2. The API response structure is unexpected
3. The server code doesn't handle empty/null responses properly

## Current Workaround
Since the external MCP server cannot be directly fixed, we can:
1. Use `search_clients` to find clients
2. Use `get_client` to view client details
3. Wait for the server maintainer to fix the `search_projects` bug

## Testing Results

### Working Functions:
- ✅ `search_clients()` - Returns 3 clients including "Sixty Seconds"
- ✅ `get_client(clientId)` - Successfully retrieves client details

### Failing Functions:
- ❌ `search_projects()` - All variations fail with the same error
- ❌ `search_projects({ search: "Sales Dashboard" })`
- ❌ `search_projects({ clientId: "..." })`
- ❌ `search_projects({ healthStatus: "All" })`

## Recommendation
Contact the AI Dev Hub MCP server maintainer to fix the `search_projects` function to handle:
1. Empty project arrays
2. Null/undefined responses
3. Proper error handling for edge cases

## Alternative Solution
If you need to access projects immediately, you could:
1. Use the AI Dev Hub web interface directly
2. Access the database/API directly if you have credentials
3. Wait for the MCP server fix






