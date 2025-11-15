# Sales Dashboard MCP Server

MCP (Model Context Protocol) server for the Sixty Sales Dashboard that provides tools for Claude to interact with the CRM system.

## Features

The MCP server exposes the following tools:

1. **create_roadmap_item** - Create new roadmap items (features, bugs, improvements)
2. **summarize_meetings** - Summarize meetings for any time period
3. **find_coldest_deals** - Identify deals that need attention
4. **create_task** - Create tasks in the CRM
5. **write_impactful_emails** - Generate high-impact emails for the week

## Installation

```bash
cd mcp-servers/sales-dashboard-mcp
npm install
npm run build
```

## Configuration

Set the following environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export USER_ID="optional-user-id-for-testing"
```

## Usage

### As Standalone MCP Server

```bash
npm start
```

### Integration with Copilot

The Copilot Edge Function (`api-copilot`) has these tools built-in. When users ask the Copilot to:

- "Create a new Roadmap item"
- "Summarise my meetings for the week"
- "What deals are the coldest"
- "Set up a new task"
- "Write me 5 emails that will make the biggest impact this week"

Claude will automatically use the appropriate tools to complete these actions.

## Example Queries

- "Create a roadmap item for adding email templates"
- "Summarize my meetings from last week"
- "Show me the 5 coldest deals"
- "Create a task to follow up with John Smith"
- "Write 5 impactful emails for this week focusing on high-value deals"

## Architecture

The tools are implemented directly in the Edge Function for performance and simplicity. The MCP server can be used as a standalone service if needed for external integrations.

