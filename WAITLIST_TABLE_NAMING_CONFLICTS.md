# Waitlist System Table Naming Conflicts - Complete Resolution

## Summary

The waitlist admin management system implementation encountered **TWO table naming conflicts** with existing tables in the database. Both have been resolved by renaming the waitlist tables.

---

## Conflict 1: Email Templates

### Issue Discovered

The waitlist admin implementation originally used a table name `email_templates`, which **conflicts with an existing table** created in migration `20240101000000_email_calendar_mcp.sql` for the Email/Calendar MCP integration feature.

### Existing `email_templates` Table (MCP Integration)
- **Purpose**: User email composition templates
- **Schema**: `user_id`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`, `is_public`, `usage_count`
- **RLS**: User-specific or public templates
- **Usage**: Email composition and MCP server integration

### New `waitlist_email_templates` Table (Waitlist Admin)
- **Purpose**: Admin waitlist invitation email templates
- **Schema**: `template_name`, `template_type`, `subject_line`, `email_body`, `is_default`, `is_active`, `created_by`
- **RLS**: Admin-only access
- **Usage**: Bulk waitlist access granting with customizable invitation emails

### Resolution

Renamed the waitlist admin table to **`waitlist_email_templates`** to avoid the naming conflict.

---

## Conflict 2: User Onboarding Progress

### Issue Discovered

The waitlist admin implementation originally used a table name `user_onboarding_progress`, which **conflicts with an existing table** created in migration `20251127000001_create_user_onboarding_progress.sql` for the general platform onboarding feature.

### Existing `user_onboarding_progress` Table (General Onboarding)
- **Purpose**: General platform user onboarding tracking
- **Schema**: `user_id`, `onboarding_step`, `onboarding_completed_at`, `skipped_onboarding`, `fathom_connected`, `first_meeting_synced`, `first_proposal_generated`, `features_discovered`
- **RLS**: User-specific access
- **Usage**: Track general platform onboarding flow
- **Created**: 2025-11-27

### New `waitlist_onboarding_progress` Table (Waitlist Onboarding)
- **Purpose**: Waitlist-specific user onboarding tracking with 6 specific steps
- **Schema**: `user_id`, `waitlist_entry_id`, `account_created_at`, `profile_completed_at`, `first_meeting_synced_at`, `meeting_intelligence_used_at`, `crm_integrated_at`, `team_invited_at`, `completion_percentage`, `completed_steps`
- **RLS**: User-specific or admin access
- **Usage**: Track waitlist user progression through 6 specific onboarding milestones
- **Created**: 2025-11-30

### Resolution

Renamed the waitlist onboarding table to **`waitlist_onboarding_progress`** to avoid the naming conflict.

---

## Files Updated

### 1. Database Migrations (3 files)

**File**: `/supabase/migrations/20251130000001_add_email_templates.sql`
**Changes**:
- Table name: `email_templates` → `waitlist_email_templates`
- All indexes: `idx_email_templates_*` → `idx_waitlist_email_templates_*`
- Trigger function: `update_email_template_timestamp()` → `update_waitlist_email_template_timestamp()`
- Trigger name: `email_templates_updated_at` → `waitlist_email_templates_updated_at`
- Function: `get_default_email_template()` → `get_default_waitlist_email_template()`
- All RLS policies updated
- All seed INSERT statements updated
- All comments updated

**File**: `/supabase/migrations/20251130000002_add_onboarding_tracking.sql`
**Changes**:
- Table name: `user_onboarding_progress` → `waitlist_onboarding_progress`
- All indexes: `idx_onboarding_*` → `idx_waitlist_onboarding_*`
- Trigger function: `calculate_onboarding_completion()` → `calculate_waitlist_onboarding_completion()`
- Trigger name: `update_onboarding_completion` → `update_waitlist_onboarding_completion`
- Function: `mark_onboarding_step()` → `mark_waitlist_onboarding_step()`
- Function: `get_onboarding_analytics()` → `get_waitlist_onboarding_analytics()`
- Function: `get_stuck_onboarding_users()` → `get_stuck_waitlist_onboarding_users()`
- All RLS policies updated
- All comments updated

**File**: `/supabase/migrations/20251130000003_enhance_waitlist_for_access.sql`
**Changes**:
- `INSERT INTO user_onboarding_progress` → `INSERT INTO waitlist_onboarding_progress`
- Comment updated to reference waitlist onboarding

### 2. Service Layer (2 files)

**File**: `/src/lib/services/emailTemplateService.ts`
**Changes**:
- Header comment updated
- All `.from('email_templates')` → `.from('waitlist_email_templates')`
- All error messages updated
- 8 functions updated total

**File**: `/src/lib/services/onboardingService.ts`
**Changes**:
- Header comment updated
- All `.from('user_onboarding_progress')` → `.from('waitlist_onboarding_progress')`
- 2 functions updated total

### 3. Documentation

**File**: `/WAITLIST_ADMIN_IMPLEMENTATION.md`
**Changes**:
- Table name in schema section: `email_templates` → `waitlist_email_templates`
- Table name in schema section: `user_onboarding_progress` → `waitlist_onboarding_progress`
- Section heading updated: "Email Templates" → "Waitlist Email Templates"
- SQL verification queries updated

---

## Migration Status

### Not Yet Applied

The migrations have **not been pushed** to the remote database yet.

### To Apply

```bash
# Option 1: Apply all pending migrations (if in development)
supabase db push --include-all

# Option 2: Apply specific migrations individually (if in production)
psql <db-url> -f supabase/migrations/20251130000001_add_email_templates.sql
psql <db-url> -f supabase/migrations/20251130000002_add_onboarding_tracking.sql
psql <db-url> -f supabase/migrations/20251130000003_enhance_waitlist_for_access.sql
```

---

## Verification Steps

After applying migrations, verify both tables:

### Verify Email Templates

```sql
-- 1. Check waitlist_email_templates table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'waitlist_email_templates';

-- 2. Verify seed data (should return 3 templates)
SELECT template_name, template_type, is_default
FROM waitlist_email_templates
WHERE is_active = true;

-- 3. Check RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'waitlist_email_templates';

-- 4. Verify function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_default_waitlist_email_template';
```

### Verify Onboarding Progress

```sql
-- 1. Check waitlist_onboarding_progress table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'waitlist_onboarding_progress';

-- 2. Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'waitlist_onboarding_progress';

-- 3. Check RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'waitlist_onboarding_progress';

-- 4. Verify functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'mark_waitlist_onboarding_step',
  'get_waitlist_onboarding_analytics',
  'get_stuck_waitlist_onboarding_users',
  'calculate_waitlist_onboarding_completion'
);
```

### Verify No Conflicts

```sql
-- Confirm both original tables still exist (they should)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_templates', 'user_onboarding_progress');
-- Should return 2 rows

-- Confirm new waitlist tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('waitlist_email_templates', 'waitlist_onboarding_progress');
-- Should return 2 rows
```

---

## Impact Analysis

### ✅ No Breaking Changes

- No existing code references the old table names (they were never deployed)
- Service layer correctly uses new table names
- All future code will use `waitlist_email_templates` and `waitlist_onboarding_progress`
- React hooks not yet created, so no updates needed there

### ✅ Clean Separation

**Email Templates**:
- MCP email templates: User-facing composition templates
- Waitlist email templates: Admin-only invitation templates
- No functional overlap or conflict

**Onboarding Progress**:
- General onboarding: Platform-wide feature onboarding tracking
- Waitlist onboarding: Waitlist-specific 6-step progression tracking
- Different schemas and use cases

---

## Summary

**Problems**:
1. `email_templates` naming conflict with existing MCP table
2. `user_onboarding_progress` naming conflict with existing general onboarding table

**Solutions**:
1. Renamed to `waitlist_email_templates`
2. Renamed to `waitlist_onboarding_progress`

**Status**: Code updated, migrations ready, awaiting database deployment

**Risk**: None - tables never existed in production, no downstream impact

**Files Updated**: 8 files total
- 3 migration files
- 2 service files
- 1 documentation file
- 2 summary documentation files (WAITLIST_NAMING_FIX.md + this file)
