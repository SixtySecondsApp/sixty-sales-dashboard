# CRITICAL: Profile IDs Changed - Data Relationships Broken

## What Happened

The `create-users-cli.mjs` script created auth users with NEW IDs instead of preserving the original profile IDs. This means:

- ❌ All deals, activities, contacts, meetings linked to OLD profile IDs
- ❌ NEW profile IDs created by auth trigger
- ❌ Data relationships are BROKEN

## Current Situation

We now have 20 users with auth accounts BUT their profile IDs don't match the foreign keys in:
- contacts (user_id column)
- deals (user_id column)
- activities (user_id column)
- meetings (owner_user_id column)
- All other tables with user_id foreign keys

## The ONLY Solution

Since we can't change auth.users IDs and can't change profile IDs (they're referenced everywhere), we have TWO options:

###Option 1: Accept New IDs and Update All Foreign Keys (COMPLEX)

We'd need to:
1. Create a mapping table: old_profile_id → new_profile_id
2. Update EVERY table that references profiles:
   - UPDATE contacts SET user_id = new_id WHERE user_id = old_id
   - UPDATE deals SET user_id = new_id WHERE user_id = old_id
   - UPDATE activities SET user_id = new_id WHERE user_id = old_id
   - UPDATE meetings SET owner_user_id = new_id WHERE owner_user_id = old_id
   - ... (repeat for ALL tables with user_id or similar columns)

This is risky and complex because we don't know all the foreign key relationships.

### Option 2: Start Fresh from Production (RECOMMENDED)

1. **Delete development-v2 branch entirely**
2. **Create a new development-v3 branch from production**
3. **This will give you an EXACT copy with working auth**

This is the cleanest solution because:
- ✅ All IDs will match
- ✅ Auth will work out of the box
- ✅ No complex foreign key updates needed
- ✅ No risk of missing relationships

## Recommended Action

**Contact Supabase Support** and request:
1. Delete the development-v2 preview branch
2. Create a new preview branch from production
3. This will give you a working copy with all IDs intact

Alternatively, if you have database credentials, you could:
1. Use `pg_dump` from production
2. Use `pg_restore` to development-v2
3. This preserves all IDs including auth.users

## Why This Happened

Supabase's auth.admin.createUser() API generates a NEW UUID for the user, not one we specify. The auth.users table doesn't allow us to control the ID during creation. The only way to preserve IDs is to copy the entire auth schema directly via pg_dump/pg_restore.

## Next Steps

Please let me know which approach you'd like to take:
1. Try to map and update all foreign keys (complex, risky)
2. Start fresh with a new branch from production (clean, recommended)
3. Contact Supabase support for assistance
