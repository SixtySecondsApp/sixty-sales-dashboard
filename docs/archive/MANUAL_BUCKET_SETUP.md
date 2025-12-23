# Manual Storage Bucket Setup

## ✅ What's Already Done

1. ✅ **Edge Function Deployed**: `generate-video-thumbnail` is live
2. ✅ **Feature Enabled**: `ENABLE_VIDEO_THUMBNAILS=true` is set

## 🔧 Manual Step Required: Create Storage Bucket

The storage bucket needs to be created manually via the Supabase Dashboard.

### Step-by-Step Instructions

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/storage/buckets

2. **Create New Bucket**
   - Click "New bucket" button
   - **Bucket name**: `meeting-assets`
   - **Public bucket**: Toggle ON (✅ enabled)
   - Click "Create bucket"

3. **Configure Bucket Policies** (Optional - UI creates basic policies automatically)

   If you want to set up custom policies, go to:
   https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/storage/policies

   Then add these policies to `storage.objects`:

   **Policy 1: Public Read Access**
   ```sql
   CREATE POLICY "Public read access for meeting assets"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'meeting-assets');
   ```

   **Policy 2: Authenticated Upload**
   ```sql
   CREATE POLICY "Authenticated users can upload meeting assets"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'meeting-assets');
   ```

   **Policy 3: Service Role Management**
   ```sql
   CREATE POLICY "Service role can manage all meeting assets"
   ON storage.objects FOR ALL
   TO service_role
   USING (bucket_id = 'meeting-assets');
   ```

4. **Verify Bucket Creation**
   - You should see `meeting-assets` in your buckets list
   - The bucket should show as "Public"
   - Check the path structure will be: `meeting-assets/meeting-thumbnails/`

## 🧪 Test the System

Once the bucket is created, test thumbnail generation:

```bash
# Get your project details
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"
SERVICE_ROLE_KEY="your-service-role-key"

# Test with a real meeting
curl -X POST \
  "$SUPABASE_URL/functions/v1/generate-video-thumbnail" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "96397021",
    "share_url": "https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf",
    "fathom_embed_url": "https://fathom.video/embed/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf"
  }'
```

Expected response:
```json
{
  "success": true,
  "thumbnail_url": "https://ewtuefzeogytgmsnkpmb.supabase.co/storage/v1/object/public/meeting-assets/meeting-thumbnails/96397021.jpg",
  "recording_id": "96397021"
}
```

## 🔄 Re-sync Meetings

After bucket creation, re-sync your Fathom meetings to generate thumbnails for all existing meetings:

### Option 1: Via Application UI
Navigate to your Fathom integration settings and click "Sync Now"

### Option 2: Via API
```bash
curl -X POST \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 📊 Monitor Results

Check if thumbnails are being generated:

```sql
-- View thumbnail status
SELECT
  COUNT(*) as total_meetings,
  COUNT(thumbnail_url) as with_thumbnails,
  ROUND(COUNT(thumbnail_url)::numeric / COUNT(*)::numeric * 100, 2) as percentage
FROM meetings;

-- See recent thumbnails
SELECT id, title, thumbnail_url, last_synced_at
FROM meetings
WHERE thumbnail_url IS NOT NULL
ORDER BY last_synced_at DESC
LIMIT 10;

-- Check storage bucket
SELECT name, metadata->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'meeting-assets'
ORDER BY created_at DESC
LIMIT 10;
```

## 🐛 Troubleshooting

### Bucket not appearing?
- Clear browser cache and refresh dashboard
- Wait 30 seconds for system to propagate

### Thumbnails not generating?
1. Check Edge Function logs:
   ```bash
   supabase functions logs generate-video-thumbnail --tail
   ```

2. Verify feature flag:
   ```bash
   supabase secrets list | grep ENABLE_VIDEO_THUMBNAILS
   ```

3. Test bucket permissions:
   - Try uploading a test file via dashboard
   - Verify public URL works

### 403 Forbidden errors?
- Check RLS policies are configured correctly
- Verify bucket is set to "Public"
- Ensure service role has proper permissions

## ✨ Next Steps

Once the bucket is created and working:

1. ✅ Edge Function is deployed
2. ✅ Feature flag is enabled
3. 🔧 Create bucket manually (above)
4. 🧪 Test thumbnail generation
5. 🔄 Re-sync meetings
6. 📊 Monitor success rate

---

**Quick Reference:**
- Dashboard: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
- Storage: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/storage/buckets
- Functions: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions

**Support Files:**
- VIDEO_THUMBNAIL_SETUP.md - Complete technical documentation
- THUMBNAIL_DEPLOYMENT_QUICKSTART.md - Quick deployment guide
- deploy-thumbnail-service.sh - Automated deployment script
