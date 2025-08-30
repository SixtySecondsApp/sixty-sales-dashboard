# Manual Database Fix for API Keys System

## Current Issue

The API keys table exists but is missing the `is_active` column, causing the Edge Function and frontend to fail.

## Current Table State

✅ **Existing columns**:
- `id` (UUID, primary key)
- `name` (TEXT)
- `key_hash` (TEXT, unique)
- `key_preview` (TEXT)
- `user_id` (UUID, references profiles)
- `permissions` (TEXT[])
- `rate_limit` (INTEGER)
- `usage_count` (INTEGER)
- `last_used` (TIMESTAMP WITH TIME ZONE)
- `last_used_at` (TIMESTAMP WITH TIME ZONE) - duplicate, should be cleaned
- `expires_at` (TIMESTAMP WITH TIME ZONE)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

❌ **Missing columns**:
- `is_active` (BOOLEAN) - Required by frontend and Edge Function

## Manual Fix Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**:
   - Open your project: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
   - Navigate to Database > Tables

2. **Find api_keys table**:
   - Click on the `api_keys` table
   - Click "Add column" button

3. **Add the missing column**:
   - **Column name**: `is_active`
   - **Type**: `bool` (boolean)
   - **Default value**: `true`
   - **Nullable**: No (uncheck nullable)
   - Click "Save"

4. **Verify the fix**:
   - Run: `node verify-api-keys-fix.js`
   - Should show all green checkmarks

### Option 2: SQL Editor (Advanced)

1. **Go to SQL Editor** in Supabase Dashboard

2. **Run this SQL**:
   ```sql
   -- Add missing is_active column
   ALTER TABLE api_keys 
   ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

   -- Clean up duplicate column if it exists
   DO $$ 
   BEGIN
       IF EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'api_keys' 
           AND column_name = 'last_used_at'
       ) AND EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'api_keys' 
           AND column_name = 'last_used'
       ) THEN
           -- Copy data from last_used_at to last_used if needed
           UPDATE api_keys 
           SET last_used = last_used_at 
           WHERE last_used IS NULL AND last_used_at IS NOT NULL;
           
           -- Drop the duplicate column
           ALTER TABLE api_keys DROP COLUMN last_used_at;
       END IF;
   END $$;
   ```

3. **Click "Run"** to execute

### Option 3: Migration File (If using local development)

If you're running Supabase locally:

1. **Apply the consolidated migration**:
   ```bash
   supabase db push
   ```

2. **Or create a new migration**:
   ```bash
   supabase migration new add_missing_is_active_column
   ```

3. **Add this SQL to the new migration file**:
   ```sql
   ALTER TABLE api_keys 
   ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
   ```

4. **Apply the migration**:
   ```bash
   supabase db push
   ```

## Verification

After applying any of the above fixes:

1. **Run verification script**:
   ```bash
   node verify-api-keys-fix.js
   ```

2. **Expected output**:
   ```
   ✅ api_keys table is accessible
   ✅ All required columns are present
   ✅ api_requests table is accessible
   ✅ hash_api_key function works
   ✅ generate_api_key function works
   ✅ ALL CHECKS PASSED!
   ```

## Test API Key Creation

After the database fix:

1. **Go to your application**
2. **Navigate to API Key management page**
3. **Create a new API key**
4. **Verify it appears in the list with preview format**

## Expected Table Structure After Fix

```sql
CREATE TABLE api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_preview TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['deals:read'],
    rate_limit INTEGER NOT NULL DEFAULT 500,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,  -- This was missing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## If Issues Persist

If you still have issues after adding the `is_active` column:

1. **Check RLS policies**:
   - Ensure the service role can access the table
   - Users should be able to access their own keys

2. **Check Edge Function logs**:
   - Go to Supabase Dashboard > Edge Functions
   - Check logs for the `create-api-key` function

3. **Check browser console**:
   - Look for JavaScript errors
   - Verify API calls are being made correctly

4. **Contact support**:
   - Provide the error message and verification script output

## Success Indicators

✅ API key creation works through the UI
✅ Keys display with preview format (sk_1234abcd...xyz9)
✅ Keys can be used for API authentication
✅ Usage tracking increments correctly
✅ Rate limiting works as expected

---

**Next Step**: Apply the manual fix above, then run `node verify-api-keys-fix.js` to confirm everything works.