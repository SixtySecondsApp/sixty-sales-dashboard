# Video Thumbnail Generation - Quick Deployment Guide

## ✅ What's Been Built

A complete video thumbnail generation system that:
- Captures actual video frames from Fathom recordings
- Uses browser automation services (Microlink/ScreenshotOne/Browserless)
- Stores thumbnails in Supabase Storage
- Integrates seamlessly with existing sync workflow

## 🚀 Deployment Steps (5 minutes)

### Option 1: Automated Deployment (Recommended)

```bash
# Make script executable
chmod +x deploy-thumbnail-service.sh

# Run deployment script (it will guide you through the process)
./deploy-thumbnail-service.sh
```

### Option 2: Manual Deployment

```bash
# Step 1: Deploy Edge Function
supabase functions deploy generate-video-thumbnail

# Step 2: Create Storage Bucket
supabase db push

# Step 3: Enable Feature
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true

# Step 4: (Optional) Configure Screenshot Service
# Microlink works out of the box with no setup (free tier: 50/day)
# OR set up ScreenshotOne:
supabase secrets set SCREENSHOTONE_API_KEY=your_api_key

# OR set up Browserless:
supabase secrets set BROWSERLESS_TOKEN=your_token

# Step 5: Test
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/generate-video-thumbnail' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "recording_id": "96397021",
    "share_url": "https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf",
    "fathom_embed_url": "https://fathom.video/embed/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf"
  }'
```

## 📊 Screenshot Service Comparison

| Service | Free Tier | Best For | Setup Required |
|---------|-----------|----------|----------------|
| **Microlink** | 50/day | Getting started, low volume | ❌ No (works immediately) |
| **ScreenshotOne** | 100/month | Best quality, medium volume | ✅ Yes (API key) |
| **Browserless** | Available | High volume, most reliable | ✅ Yes (token) |

**Recommendation**: Start with Microlink (no setup needed), upgrade to ScreenshotOne if you need more.

## 🔍 Verify Deployment

### Check Edge Function Status
```bash
supabase functions list
# Should show: generate-video-thumbnail
```

### Check Storage Bucket
```bash
supabase storage list
# Should show: meeting-assets
```

### View Logs
```bash
supabase functions logs generate-video-thumbnail --tail
```

## 🔄 Re-sync to Generate Thumbnails

After deployment, re-sync your meetings to generate thumbnails:

```bash
# Via your Fathom sync endpoint
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

Or trigger sync from your application UI.

## 📈 Monitor Success Rate

```sql
-- Check how many meetings have thumbnails
SELECT
  COUNT(*) as total_meetings,
  COUNT(thumbnail_url) as with_thumbnails,
  ROUND(COUNT(thumbnail_url)::numeric / COUNT(*)::numeric * 100, 2) as percentage
FROM meetings;

-- Find meetings without thumbnails
SELECT id, title, share_url, last_synced_at
FROM meetings
WHERE thumbnail_url IS NULL
ORDER BY last_synced_at DESC
LIMIT 20;
```

## 🐛 Troubleshooting

### Thumbnails not generating?

1. **Check if feature is enabled:**
   ```bash
   supabase secrets list | grep ENABLE_VIDEO_THUMBNAILS
   ```

2. **Check Edge Function logs:**
   ```bash
   supabase functions logs generate-video-thumbnail --tail
   ```

3. **Verify storage bucket exists:**
   - Go to Supabase Dashboard → Storage
   - Check if `meeting-assets` bucket exists
   - Ensure it's set to public

4. **Test API key (if using ScreenshotOne):**
   ```bash
   curl "https://api.screenshotone.com/take?access_key=YOUR_KEY&url=https://example.com"
   ```

### Poor quality thumbnails?

- Increase wait time in Edge Function (currently 5 seconds)
- Try ScreenshotOne (best quality)
- Increase image quality setting (currently 80%)

## 💰 Cost Estimates

| Monthly Volume | Microlink | ScreenshotOne | Browserless |
|----------------|-----------|---------------|-------------|
| 50 meetings | **Free** | Free | Free |
| 100 meetings | $9 | **Free** | Free |
| 500 meetings | $9 | **$19** | ~$15 |
| 1,000 meetings | $9 | **$19** | ~$30 |

## 📚 Complete Documentation

For detailed information, see:
- **VIDEO_THUMBNAIL_SETUP.md** - Complete setup guide
- **FATHOM_SYNC_COVERAGE.md** - Data coverage analysis
- **deploy-thumbnail-service.sh** - Automated deployment script

## ✨ What Happens During Sync

When you sync meetings, the system now:

1. ✅ Fetches meeting data from Fathom API
2. ✅ Tries to get thumbnail via free methods (og:image, embed poster)
3. 🆕 **If no thumbnail found, generates video screenshot**
4. ✅ Uploads screenshot to Supabase Storage
5. ✅ Stores public URL in `meetings.thumbnail_url`
6. ✅ Thumbnail appears in MeetingsList component

## 🎯 Success Criteria

After deployment, you should see:
- ✅ Thumbnails displaying in meetings list
- ✅ Storage bucket populating with .jpg files
- ✅ `thumbnail_url` field populated in database
- ✅ Edge Function logs showing successful captures

---

**Status**: ✅ Ready for deployment
**Estimated deployment time**: 5 minutes
**Next step**: Run `./deploy-thumbnail-service.sh`
