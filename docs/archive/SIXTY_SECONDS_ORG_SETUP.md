# Sixty Seconds Organization Setup

This document describes the setup for the 'Sixty Seconds' organization that automatically assigns all users with `@sixtyseconds.video` email addresses.

## What Was Created

### 1. Organization Creation (Migration: `20251202180000_create_sixty_seconds_org.sql`)

- **Organization Name**: "Sixty Seconds"
- **Default Role**: All @sixtyseconds.video users are assigned as **owners**
- **Automatic Backfill**: Finds and adds all existing users with @sixtyseconds.video email addresses

### 2. Auto-Assignment System (Migration: `20251202180001_auto_assign_sixty_seconds_org.sql`)

- **Trigger on `auth.users`**: Automatically assigns new signups with @sixtyseconds.video emails
- **Trigger on `profiles`**: Catches email updates in the profiles table
- **Function**: `auto_assign_to_sixty_seconds_org()` handles the assignment logic

## How It Works

### For Existing Users
When the migration runs, it will:
1. Create the "Sixty Seconds" organization
2. Scan both `auth.users.email` and `profiles.email` for @sixtyseconds.video addresses
3. Add all matching users as owners of the organization
4. Log the results with NOTICE messages

### For New Users
When a new user signs up with an @sixtyseconds.video email:
1. The trigger automatically fires after user creation
2. The user is immediately added to the Sixty Seconds organization as an owner
3. No manual intervention needed

### For Email Updates
If an existing user updates their email to @sixtyseconds.video:
1. The profiles trigger fires on email update
2. The user is automatically added to the Sixty Seconds organization
3. Their role is set to owner

## Verification

Run the verification script to check the setup:

```bash
# Using Supabase CLI
supabase db execute -f verify-sixty-seconds-org.sql

# Or using psql
psql $DATABASE_URL -f verify-sixty-seconds-org.sql
```

The verification script will show:
1. The Sixty Seconds organization details
2. All users with @sixtyseconds.video email addresses
3. Current organization memberships
4. Count summary
5. Status of auto-assignment triggers

## Manual Operations

### Manually Add a User to Sixty Seconds Org

```sql
-- Get the organization ID
SELECT id FROM organizations WHERE name = 'Sixty Seconds';

-- Add user (replace user_id with actual UUID)
INSERT INTO organization_memberships (org_id, user_id, role)
VALUES (
  (SELECT id FROM organizations WHERE name = 'Sixty Seconds'),
  'user-uuid-here',
  'owner'
)
ON CONFLICT (org_id, user_id) DO UPDATE
SET role = 'owner';
```

### Check Specific User's Organizations

```sql
SELECT
  o.name as org_name,
  om.role,
  om.created_at
FROM organization_memberships om
JOIN organizations o ON o.id = om.org_id
WHERE om.user_id = 'user-uuid-here'
ORDER BY om.created_at;
```

### Disable Auto-Assignment (if needed)

```sql
-- Disable the triggers
ALTER TABLE auth.users DISABLE TRIGGER auto_assign_sixty_seconds_org_trigger;
ALTER TABLE profiles DISABLE TRIGGER auto_assign_sixty_seconds_org_profiles_trigger;

-- Re-enable if needed
ALTER TABLE auth.users ENABLE TRIGGER auto_assign_sixty_seconds_org_trigger;
ALTER TABLE profiles ENABLE TRIGGER auto_assign_sixty_seconds_org_profiles_trigger;
```

## Deployment

To deploy these changes:

1. **Using Supabase CLI** (Recommended):
   ```bash
   supabase db push
   ```

2. **Manual Deployment**:
   ```bash
   # Apply migrations in order
   supabase db execute -f supabase/migrations/20251202180000_create_sixty_seconds_org.sql
   supabase db execute -f supabase/migrations/20251202180001_auto_assign_sixty_seconds_org.sql
   ```

3. **Verify the setup**:
   ```bash
   supabase db execute -f verify-sixty-seconds-org.sql
   ```

## Expected Behavior

After deployment:
- ✅ "Sixty Seconds" organization exists in the database
- ✅ All existing @sixtyseconds.video users are owners of the org
- ✅ New @sixtyseconds.video signups are automatically added
- ✅ Email updates to @sixtyseconds.video trigger auto-assignment
- ✅ Triggers are active on both auth.users and profiles tables

## Troubleshooting

### No Users Found
If the migration reports no users were found:
- Check if any users exist with @sixtyseconds.video email addresses
- Verify the email pattern matching in the query
- Check both `auth.users.email` and `profiles.email` columns

### Users Not Auto-Assigned
If new users aren't being assigned:
1. Check trigger status: Run the verification script (section 5)
2. Verify the organization exists: `SELECT * FROM organizations WHERE name = 'Sixty Seconds';`
3. Check database logs for error messages
4. Ensure triggers are enabled (see "Disable Auto-Assignment" section above)

### Duplicate Membership Errors
The migrations use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` to handle duplicates gracefully. If you see errors, check that the unique constraint exists:

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'organization_memberships'::regclass;
```

## Security Considerations

- The `auto_assign_to_sixty_seconds_org()` function runs with `SECURITY DEFINER`
- This allows it to insert into organization_memberships regardless of RLS policies
- Only @sixtyseconds.video email addresses trigger the assignment
- All operations are logged with NOTICE/WARNING messages

## Related Files

- `supabase/migrations/20251202180000_create_sixty_seconds_org.sql` - Creates organization and backfills users
- `supabase/migrations/20251202180001_auto_assign_sixty_seconds_org.sql` - Sets up auto-assignment triggers
- `verify-sixty-seconds-org.sql` - Verification queries
