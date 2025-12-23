# Cursor MCP Setup Guide - Sales Dashboard

This guide explains how to connect your Sales Dashboard MCP server to Cursor.

## ✅ What's Already Done

The Sales Dashboard MCP server has been added to `.cursor/mcp.json`. The server is built and ready to use.

## 🌐 Production Environment

**Frontend URL**: `https://sales.sixtyseconds.video`  
**Backend**: Supabase (you'll need the Supabase project URL, not the frontend URL)

## 🔧 Setup Steps

### 1. Set Environment Variables

The MCP server needs access to your Supabase credentials. You have two options:

#### Option A: Add to Your Existing `.env` File (Recommended)

If you already have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env`, just add the service role key:

```bash
# Your existing Vite variables (for frontend)
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

# Add this for MCP server (service role key has full database access)
VITE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
# Or use non-prefixed version:
# SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional: User ID for MCP operations
USER_ID=""
```

**Note**: 
- The MCP server will automatically use `VITE_SUPABASE_URL` if `SUPABASE_URL` isn't set
- The service role key is different from the anon key - get it from Supabase Dashboard → Settings → API → service_role key
- `.env` files are automatically gitignored, so your secrets are safe

#### Option B: Set in Your Shell Profile

Alternatively, add these to your `~/.zshrc` (or `~/.bashrc` on Linux):

```bash
# Sales Dashboard MCP Server Configuration
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
export USER_ID="your-user-id-optional"  # Optional: leave empty if not needed
```

**Get your credentials:**
- **Supabase URL**: Dashboard → Settings → API → Project URL (e.g., `https://ewtuefzeogytgmsnkpmb.supabase.co`)
  - ⚠️ **Note**: This is the Supabase backend URL, NOT the frontend URL (`sales.sixtyseconds.video`)
- **Service Role Key**: Dashboard → Settings → API → service_role key (⚠️ Keep secret!)
- **User ID**: Optional - your user UUID from Supabase auth.users table

After adding, reload your shell:
```bash
source ~/.zshrc
```

#### Option C: Set Directly in Cursor Config (Alternative)

If you prefer explicit environment variables in the config file, you can add them to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "SalesDashboard": {
      "command": "node",
      "args": ["mcp-servers/sales-dashboard-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project-ref.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key-here",
        "USER_ID": ""
      }
    }
  }
}
```

**Important**: Use your Supabase project URL (e.g., `https://ewtuefzeogytgmsnkpmb.supabase.co`), not the frontend URL (`sales.sixtyseconds.video`).

⚠️ **Warning**: If you hardcode secrets, make sure `.cursor/mcp.json` is in your `.gitignore`!

### 2. Restart Cursor

After setting environment variables, **restart Cursor** completely for the MCP server to connect.

### 3. Verify Connection

Once Cursor restarts, the Sales Dashboard MCP server should be available. You can test it by asking me to:

- "Create a roadmap item for adding email templates"
- "Summarize my meetings from last week"
- "Show me the 5 coldest deals"
- "Create a task to follow up with John Smith"
- "Write 5 impactful emails for this week"

## 🛠️ Available MCP Tools

The Sales Dashboard MCP server provides these tools:

1. **create_roadmap_item** - Create new roadmap items (features, bugs, improvements)
2. **summarize_meetings** - Summarize meetings for any time period
3. **find_coldest_deals** - Identify deals that need attention
4. **create_task** - Create tasks in the CRM
5. **write_impactful_emails** - Generate high-impact emails for the week

## 🔍 Troubleshooting

### MCP Server Not Connecting

1. **Check environment variables are set:**
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Verify the server is built:**
   ```bash
   ls -la mcp-servers/sales-dashboard-mcp/dist/index.js
   ```

3. **Test the server manually:**
   ```bash
   cd mcp-servers/sales-dashboard-mcp
   SUPABASE_URL="your-url" SUPABASE_SERVICE_ROLE_KEY="your-key" node dist/index.js
   ```

4. **Check Cursor logs:**
   - Cursor → Settings → MCP → Check for connection errors

### Permission Errors

- Ensure `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key (not anon key)
- The service role key bypasses RLS, which is needed for MCP operations

### Server Not Found

- Make sure you're in the workspace root directory
- Verify the path `mcp-servers/sales-dashboard-mcp/dist/index.js` exists
- Rebuild if needed: `cd mcp-servers/sales-dashboard-mcp && npm run build`

## 📝 Notes

- The MCP server uses the **service_role** key to bypass RLS and access all data
- `USER_ID` is optional - if not set, some operations may default to a system user
- The server is already built in the `dist/` folder
- You can rebuild with: `cd mcp-servers/sales-dashboard-mcp && npm run build`

## 🔐 Security

⚠️ **Important**: Never commit your `SUPABASE_SERVICE_ROLE_KEY` to git!

- Add `.cursor/mcp.json` to `.gitignore` if you hardcode secrets
- Or use environment variables (recommended)
- The service role key has full database access - keep it secure

