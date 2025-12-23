# Waitlist Email Templates - Naming Conflict Resolution

## Issue Discovered

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

## Resolution: Table Rename

Renamed the waitlist admin table to **`waitlist_email_templates`** to avoid the naming conflict.

## Files Updated

### 1. Database Migration
**File**: `/supabase/migrations/20251130000001_add_email_templates.sql`

**Changes**:
- Table name: `email_templates` → `waitlist_email_templates`
- Indexes: `idx_email_templates_*` → `idx_waitlist_email_templates_*`
- Trigger function: `update_email_template_timestamp()` → `update_waitlist_email_template_timestamp()`
- Trigger name: `email_templates_updated_at` → `waitlist_email_templates_updated_at`
- RLS policies: Updated all policy names to reference `waitlist_email_templates`
- INSERT statements: All 3 seed templates now insert into `waitlist_email_templates`
- Function: `get_default_email_template()` → `get_default_waitlist_email_template()`
- Comments: Updated table and column comments

### 2. Service Layer
**File**: `/src/lib/services/emailTemplateService.ts`

**Changes**:
- Header comment: Added note about table rename to avoid MCP conflict
- All `.from('email_templates')` → `.from('waitlist_email_templates')`
- Error messages: Updated to reference "waitlist email templates"
- Function comments: Updated to clarify "waitlist email template" operations

**Functions Updated** (8 total):
- `getEmailTemplates()`
- `getEmailTemplate()`
- `getDefaultTemplate()`
- `createEmailTemplate()`
- `updateEmailTemplate()`
- `deleteEmailTemplate()`
- `setDefaultTemplate()`
- Error logging messages

### 3. Other Files
No other files needed updating. The following were checked and confirmed to have no references:
- React hooks (not yet created or using service functions)
- UI components (not yet created or using service functions)
- Other service files (no direct database references)

## Migration Status

### Not Yet Applied
The migrations have **not been pushed** to the remote database yet due to dependency issues with earlier migrations.

### To Apply
```bash
# Option 1: Push all pending migrations (if in development)
supabase db push --include-all

# Option 2: Apply specific migration (if in production)
psql <db-url> -f supabase/migrations/20251130000001_add_email_templates.sql
psql <db-url> -f supabase/migrations/20251130000002_add_onboarding_tracking.sql
psql <db-url> -f supabase/migrations/20251130000003_enhance_waitlist_for_access.sql
```

## Verification Steps

After applying migrations, verify:

```sql
-- 1. Check table exists with correct name
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

## Impact Analysis

### ✅ No Breaking Changes
- No existing code references the old table name (it was never deployed)
- Service layer correctly uses new table name
- All future code will use `waitlist_email_templates`

### ✅ Clean Separation
- MCP email templates: User-facing composition templates
- Waitlist email templates: Admin-only invitation templates
- No functional overlap or conflict

## Next Steps

1. ✅ **Completed**: Updated migration file
2. ✅ **Completed**: Updated service layer
3. ✅ **Completed**: Verified no other references
4. ⏳ **Pending**: Apply migrations to database
5. ⏳ **Pending**: Test functionality end-to-end
6. ⏳ **Pending**: Update implementation documentation

## Documentation Updates Needed

The following documentation files reference the old table name and should be updated:

- `/WAITLIST_ADMIN_IMPLEMENTATION.md` - Update all references from `email_templates` to `waitlist_email_templates`

## Summary

**Problem**: Naming conflict with existing MCP `email_templates` table

**Solution**: Renamed to `waitlist_email_templates` throughout codebase

**Status**: Code updated, migrations ready, awaiting database deployment

**Risk**: None - table never existed in production, no downstream impact
