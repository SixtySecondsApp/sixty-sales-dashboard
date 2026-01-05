# Supabase Storage Migration Guide

This guide helps you migrate all storage buckets and files from your old Supabase project to the new project.

## Prerequisites

1. **Service Role Keys**: You need service role keys for both projects:
   - Old project service role key
   - New project service role key

2. **Environment Variables**: Set these in your `.env.local` or export them:

```bash
# Old project (source)
OLD_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
OLD_SUPABASE_SERVICE_KEY=your-old-service-role-key

# New project (destination)
NEW_SUPABASE_URL=https://ygdpgliavpxeugaajgrb.supabase.co
NEW_SUPABASE_SERVICE_KEY=your-new-service-role-key

# Or use the current project config
VITE_SUPABASE_URL=https://ygdpgliavpxeugaajgrb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
```

## Migration Scripts

### Option 1: Comprehensive Storage Migration (Recommended)

Migrates **all buckets** and files automatically:

```bash
node scripts/migrate-storage.mjs
```

**What it does:**
1. Lists all buckets in the old project
2. Creates corresponding buckets in the new project (with same settings)
3. Copies all files from old buckets to new buckets
4. Updates database references to point to new URLs

**Features:**
- ✅ Handles nested folders recursively
- ✅ Preserves file metadata (MIME types, sizes)
- ✅ Updates database URLs automatically
- ✅ Provides detailed progress and statistics
- ✅ Safe to run multiple times (uses upsert)

### Option 2: Profile Images Only

If you only need to migrate profile images:

```bash
node scripts/migrate-profile-images.mjs
```

**What it does:**
- Migrates only the `profile-images` bucket
- Updates `profiles.avatar_url` references

## Step-by-Step Migration

### 1. Prepare Environment

Create or update `.env.local` in the project root:

```bash
# Old project credentials
OLD_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
OLD_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# New project credentials
VITE_SUPABASE_URL=https://ygdpgliavpxeugaajgrb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Run Migration

```bash
# Make script executable (if needed)
chmod +x scripts/migrate-storage.mjs

# Run migration
node scripts/migrate-storage.mjs
```

### 3. Verify Migration

After migration completes, verify:

**Check buckets:**
```bash
# List buckets in new project
node -e "
import('@supabase/supabase-js').then(({ createClient }) => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  supabase.storage.listBuckets().then(({ data }) => {
    console.log('Buckets:', data?.map(b => b.name).join(', '));
  });
});
"
```

**Check database references:**
```bash
# Check for any remaining old URLs
node scripts/check-old-urls.mjs
```

**Check file counts:**
```sql
-- In Supabase SQL Editor, check storage objects
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM((metadata->>'size')::bigint) as total_size_bytes
FROM storage.objects
GROUP BY bucket_id;
```

## Common Buckets

Based on the codebase, these buckets are commonly used:

1. **`profile-images`** - User avatars
   - Referenced in: `profiles.avatar_url`, `contacts.avatar_url`

2. **`meeting-assets`** - Meeting thumbnails and assets
   - Referenced in: `meetings.thumbnail_url`

3. **`Logos`** - Application logos and icons
   - Referenced in: Copilot bot icon

4. **`attachments`** - File attachments
   - Referenced in: `activities.attachment_url`, `tasks.attachment_url`

## Troubleshooting

### Error: "Missing service role key"

**Solution:** Make sure you've set the environment variables:
```bash
export SUPABASE_SERVICE_ROLE_KEY=your-key
# Or add to .env.local
```

### Error: "Bucket already exists"

**Solution:** This is normal if you've run the migration before. The script will skip existing buckets and continue.

### Error: "Permission denied" or "403 Forbidden"

**Solution:** 
1. Verify your service role key is correct
2. Check that the key has storage access enabled
3. Ensure RLS policies allow service role access

### Files not appearing in new project

**Solution:**
1. Check Edge Function logs for upload errors
2. Verify bucket is set to "Public" if files need public access
3. Check RLS policies allow read access

### Database URLs not updating

**Solution:**
1. Run the migration script again (it's safe to re-run)
2. Manually check for old URLs:
   ```sql
   SELECT id, avatar_url FROM profiles 
   WHERE avatar_url LIKE '%ewtuefzeogytgmsnkpmb%';
   ```
3. Update manually if needed:
   ```sql
   UPDATE profiles 
   SET avatar_url = REPLACE(avatar_url, 'ewtuefzeogytgmsnkpmb', 'ygdpgliavpxeugaajgrb')
   WHERE avatar_url LIKE '%ewtuefzeogytgmsnkpmb%';
   ```

## Post-Migration Checklist

- [ ] All buckets created in new project
- [ ] File counts match between projects
- [ ] Database URLs updated (run `check-old-urls.mjs`)
- [ ] Public URLs work (test a few files)
- [ ] Edge Functions can upload to new buckets
- [ ] No 404 errors for storage assets

## Manual Bucket Creation

If you need to create buckets manually in the Supabase Dashboard:

1. Go to **Storage** → **Buckets**
2. Click **New bucket**
3. Set bucket name (e.g., `profile-images`)
4. Toggle **Public bucket** ON (if files need public access)
5. Set file size limits and allowed MIME types
6. Click **Create bucket**

## RLS Policies

After migration, ensure RLS policies are set up correctly:

**Public Read Access:**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'your-bucket-name');
```

**Authenticated Upload:**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'your-bucket-name');
```

## Support

If you encounter issues:

1. Check the migration script output for specific errors
2. Review Supabase Dashboard → Storage → Logs
3. Verify environment variables are set correctly
4. Check that service role keys have proper permissions

---

**Quick Reference:**
- Migration script: `scripts/migrate-storage.mjs`
- Check old URLs: `scripts/check-old-urls.mjs`
- Profile images only: `scripts/migrate-profile-images.mjs`
