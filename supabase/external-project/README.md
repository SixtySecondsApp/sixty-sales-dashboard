# External Supabase Project Setup

This directory contains migrations for the **customer-facing external Supabase project**.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared Clerk Auth                            │
│                    (Both projects verify JWTs)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   Internal Project      │         │   External Project      │
│   ewtuefzeogytgmsnkpmb  │         │   cregubixyglvfzvtlgit  │
├─────────────────────────┤         ├─────────────────────────┤
│ • Deals & Pipeline      │         │ • Meetings              │
│ • Activities            │         │ • Meeting Intelligence  │
│ • Tasks                 │         │ • Team Analytics        │
│ • Leads                 │         │ • User Settings         │
│ • Workflows             │         │ • Profiles              │
│ • Admin Features        │         │ • Contacts (meeting)    │
│ • Edge Functions (ALL)  │         │ • Companies (meeting)   │
└─────────────────────────┘         └─────────────────────────┘
          │                                       ▲
          │       Edge Functions can query        │
          └───────────────────────────────────────┘
```

## Project Details

| Property | Value |
|----------|-------|
| Project Ref | `cregubixyglvfzvtlgit` |
| URL | `https://cregubixyglvfzvtlgit.supabase.co` |
| Region | (check Supabase dashboard) |

## Tables Included

### User & Auth
- `profiles` - User identity
- `clerk_user_mapping` - Maps Clerk IDs to profile UUIDs
- `organization_memberships` - Team/org relationships

### Meetings
- `meetings` - Core meeting records
- `meeting_attendees` - Participants
- `meeting_action_items` - AI-extracted action items
- `meeting_topics` - Keywords/topics
- `meeting_metrics` - Talk time analysis
- `meeting_contacts` - Contact associations
- `team_meeting_analytics` - Pre-aggregated metrics

### CRM (Meeting Context)
- `companies` - Companies linked to meetings
- `contacts` - Contacts linked to meetings

### User Settings
- `user_settings` - General preferences
- `user_notifications` - Notification preferences
- `user_ai_feature_settings` - AI feature toggles
- `user_coaching_preferences` - Coaching settings
- `user_tone_settings` - Writing tone preferences

### Intelligence
- `user_file_search_stores` - Vector stores for search
- `ai_insights` - AI-generated insights
- `sentiment_alerts` - Sentiment alerts

### Integrations
- `fathom_integrations` - Fathom connection status

## Setup Instructions

### 1. Run Migrations

Go to the Supabase Dashboard SQL Editor:
```
https://supabase.com/dashboard/project/cregubixyglvfzvtlgit/sql
```

Run the migrations in order:
1. `001_initial_schema.sql` - Creates all tables
2. `002_clerk_auth.sql` - Sets up Clerk JWT auth functions
3. `003_rls_policies.sql` - Configures row-level security

### 2. Configure Clerk JWT

In the Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Add **Custom JWT** provider
3. Configure with your Clerk JWT secret

Or via SQL:
```sql
-- Set the JWT secret in vault (get from Clerk Dashboard)
SELECT vault.create_secret('your-clerk-jwt-secret', 'clerk_jwt_secret');
```

### 3. Update Environment Variables

Add to your `.env` file:
```env
VITE_EXTERNAL_SUPABASE_URL=https://cregubixyglvfzvtlgit.supabase.co
VITE_EXTERNAL_SUPABASE_ANON_KEY=your-anon-key
EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EXTERNAL_SUPABASE_PROJECT_ID=cregubixyglvfzvtlgit
```

### 4. Seed Initial Data (Optional)

If migrating existing users, you'll need to:
1. Export profiles from internal project
2. Create clerk_user_mapping entries
3. Sync meeting data

## Edge Functions

All Edge Functions remain on the **internal project**. They can query the external database when needed by using environment variables:

```typescript
// In Edge Function
const externalDbUrl = Deno.env.get('EXTERNAL_DATABASE_URL');
```

Functions that query external DB:
- `meeting-intelligence-search`
- `meeting-intelligence-index`
- `api-v1-meetings`
- `fetch-transcript`
- `fetch-summary`

## Authentication Flow

1. User logs in via Clerk
2. Clerk issues JWT with user ID in `sub` claim
3. Frontend sends JWT to Supabase
4. Supabase extracts `sub` claim
5. `current_user_id()` function maps Clerk ID → profile UUID
6. RLS policies use `current_user_id()` for access control

## Data Sync Strategy

For features that span both projects (e.g., Fathom sync):
1. Fathom integration config stored on **internal**
2. Meeting data synced to **external**
3. Edge Function on internal handles the sync

## Testing

Verify setup with:
```sql
-- Test auth function
SELECT current_user_id();

-- Test RLS
SELECT * FROM meetings LIMIT 5;

-- Check policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```
