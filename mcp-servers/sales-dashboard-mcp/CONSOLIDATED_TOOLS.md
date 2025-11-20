# Consolidated MCP Tools - Token Optimization

## Overview

All CRUD operations have been consolidated into single tools per entity to significantly reduce token usage. Instead of having separate tools like `create_deal`, `get_deal`, `update_deal`, `delete_deal`, we now have a single `manage_deals` tool with an `operation` parameter.

## Tool Reduction

**Before**: ~30+ separate tools  
**After**: 12 consolidated tools  
**Token Savings**: ~60% reduction in tool list size

## Available Tools

### Consolidated CRUD Tools (7 tools)

1. **`manage_deals`** - All deal operations
   - Operations: `create`, `read`, `update`, `delete`, `search`, `move_stage`
   - Example: `{ "operation": "create", "name": "Acme Corp Deal", "company": "Acme Corp", "value": 50000 }`

2. **`manage_contacts`** - All contact operations
   - Operations: `create`, `read`, `update`, `delete`, `search`
   - Example: `{ "operation": "search", "search": "john@example.com" }`

3. **`manage_companies`** - All company operations
   - Operations: `create`, `read`, `update`, `delete`, `search`
   - Example: `{ "operation": "create", "name": "Acme Corp", "website": "https://acme.com" }`

4. **`manage_activities`** - All activity operations
   - Operations: `create`, `read`, `update`, `delete`, `search`
   - Example: `{ "operation": "create", "type": "call", "date": "2025-01-15", "subject": "Discovery call" }`

5. **`manage_tasks`** - All task operations
   - Operations: `create`, `read`, `update`, `delete`, `complete`, `search`
   - Example: `{ "operation": "complete", "id": "task-id-here" }`

6. **`manage_meetings`** - All meeting operations
   - Operations: `create`, `read`, `update`, `delete`, `search`
   - Example: `{ "operation": "search", "startDate": "2025-01-01", "endDate": "2025-01-31" }`

7. **`manage_roadmap`** - All roadmap operations
   - Operations: `create`, `read`, `update`, `delete`, `search`
   - Example: `{ "operation": "search", "status_filter": "in_progress" }`

### Specialized Query Tools (5 tools)

8. **`summarize_meetings`** - Summarize meetings for time periods
9. **`find_coldest_deals`** - Find deals with lowest engagement
10. **`find_at_risk_deals`** - Find deals at risk based on health/risk scores
11. **`write_impactful_emails`** - Generate high-impact email suggestions
12. **`get_performance_analytics`** - Comprehensive performance analytics

## Usage Examples

### Create a Deal
```json
{
  "operation": "create",
  "name": "Acme Corp Enterprise Deal",
  "company": "Acme Corp",
  "value": 100000,
  "stage_id": "stage-uuid-here",
  "expected_close_date": "2025-03-31"
}
```

### Search Deals
```json
{
  "operation": "search",
  "status": "active",
  "minValue": 50000,
  "limit": 20
}
```

### Update a Deal
```json
{
  "operation": "update",
  "id": "deal-uuid-here",
  "value": 120000,
  "probability": 75
}
```

### Move Deal to Stage
```json
{
  "operation": "move_stage",
  "id": "deal-uuid-here",
  "stage_id": "new-stage-uuid-here"
}
```

### Create Contact
```json
{
  "operation": "create",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "company_id": "company-uuid-here"
}
```

### Search Contacts
```json
{
  "operation": "search",
  "search": "john",
  "limit": 10
}
```

### Create Activity
```json
{
  "operation": "create",
  "type": "call",
  "subject": "Discovery call with Acme Corp",
  "date": "2025-01-15T10:00:00Z",
  "deal_id": "deal-uuid-here",
  "status": "completed"
}
```

### Complete Task
```json
{
  "operation": "complete",
  "id": "task-uuid-here"
}
```

### Search Overdue Tasks
```json
{
  "operation": "search",
  "overdue_only": true,
  "limit": 20
}
```

## Benefits

1. **Reduced Token Usage**: ~60% fewer tools in the tool list
2. **Logical Grouping**: Related operations grouped together
3. **Easier to Understand**: One tool per entity type
4. **Flexible**: All operations available through single interface
5. **Consistent API**: Same pattern across all entities

## Migration Notes

- Old tool names (`create_deal`, `get_deal`, etc.) are no longer available
- Use `manage_deals` with `operation` parameter instead
- All existing functionality is preserved, just consolidated
- Specialized tools (analytics, queries) remain separate for clarity






