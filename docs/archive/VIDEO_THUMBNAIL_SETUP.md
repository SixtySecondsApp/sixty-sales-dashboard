# Video Thumbnail Generation Setup Guide

## Overview

Automated system to capture actual video frames from Fathom recordings and store them as thumbnails.

**Architecture:**
1. Fathom Sync detects missing thumbnails
2. Calls `generate-video-thumbnail` Edge Function
3. Edge Function uses browser automation service (Microlink/ScreenshotOne/Browserless)
4. Captures screenshot of video embed
5. Uploads to Supabase Storage (`meeting-assets` bucket)
6. Returns public URL to sync function
7. URL stored in `meetings.thumbnail_url`

---

## Setup Steps

### 1. Deploy Edge Function

```bash
# Deploy the thumbnail generation function
supabase functions deploy generate-video-thumbnail

# Verify deployment
supabase functions list
```

### 2. Create Storage Bucket

```bash
# Run the migration to create bucket
supabase db push

# Or manually create in Supabase Dashboard:
# 1. Go to Storage
# 2. Create new bucket: "meeting-assets"
# 3. Make it public
# 4. Set up RLS policies (see migration file)
```

### 3. Choose Screenshot Service

You have 3 options (pick one):

#### Option A: Microlink (Recommended - Free Tier)

**Pros:**
- ✅ Free tier: 50 requests/day
- ✅ No API key required
- ✅ Simple setup
- ✅ Good quality

**Cons:**
- ⚠️ Rate limited on free tier
- ⚠️ May have watermark

**Setup:**
```bash
# No setup required! Works out of the box.
# Just enable video thumbnails:
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true
```

**Cost:** Free (50/day), $9/mo for 10,000

---

#### Option B: ScreenshotOne (Best Quality)

**Pros:**
- ✅ Free tier: 100 requests/month
- ✅ High quality screenshots
- ✅ Fast and reliable
- ✅ No watermark

**Cons:**
- ⚠️ Requires API key
- ⚠️ Paid after 100/month

**Setup:**
```bash
# 1. Sign up at https://screenshotone.com
# 2. Get your API key
# 3. Set environment variables:
supabase secrets set SCREENSHOTONE_API_KEY=your_api_key_here
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true
```

**Cost:** Free (100/mo), $19/mo for 5,000

---

#### Option C: Browserless (Most Powerful)

**Pros:**
- ✅ Full browser automation
- ✅ Can wait for video to load
- ✅ Most reliable
- ✅ Free tier available

**Cons:**
- ⚠️ Requires API token
- ⚠️ More expensive

**Setup:**
```bash
# 1. Sign up at https://browserless.io
# 2. Get your token
# 3. Set environment variables:
supabase secrets set BROWSERLESS_TOKEN=your_token_here
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true
```

**Cost:** Free tier available, $30/mo for 1,000 minutes

---

### 4. Enable in Sync Function

```bash
# Enable video thumbnail generation
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true
```

---

## Testing

### Test Thumbnail Generation

```bash
# Test the function directly
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

### Test Full Sync with Thumbnails

```bash
# Re-sync a single meeting to test
# (Use your Fathom sync endpoint)
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "sync_type": "webhook",
    "call_id": "96397021"
  }'
```

---

## Environment Variables Summary

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `ENABLE_VIDEO_THUMBNAILS` | **Yes** | Enable/disable feature | `true` |
| `SCREENSHOTONE_API_KEY` | No | ScreenshotOne API | `abc123...` |
| `BROWSERLESS_TOKEN` | No | Browserless.io token | `xyz789...` |

**Priority Order:**
1. If `SCREENSHOTONE_API_KEY` set → Use ScreenshotOne
2. Else if `BROWSERLESS_TOKEN` set → Use Browserless
3. Else → Use Microlink (free, no key needed)

---

## How It Works

### Thumbnail Generation Flow

```
┌─────────────────┐
│  Fathom Sync    │
│  detects no     │
│  thumbnail      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ generateVideo   │
│ Thumbnail()     │
│ function called │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Edge Function   │
│ generate-video  │
│ -thumbnail      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Screenshot API  │
│ (Microlink/     │
│ ScreenshotOne/  │
│ Browserless)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upload to       │
│ Supabase        │
│ Storage         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return public   │
│ URL to sync     │
│ function        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store in        │
│ meetings.       │
│ thumbnail_url   │
└─────────────────┘
```

### Cascade Logic

The sync function tries methods in this order:

1. **Fathom Direct Endpoints** (fastest, free)
2. **Fathom Embed Poster** (fast, free)
3. **og:image Scraping** (fast, free)
4. **Video Screenshot** (slow, requires service) ← NEW
5. **Generated Placeholder** (fallback)

---

## Storage Structure

```
meeting-assets/
└── meeting-thumbnails/
    ├── 96397021.jpg
    ├── 96272358.jpg
    └── 96191438.jpg
```

**Files:**
- Format: JPEG (80% quality)
- Resolution: 1920x1080 (16:9 aspect ratio)
- Naming: `{recording_id}.jpg`
- Public URL: `https://YOUR_PROJECT.supabase.co/storage/v1/object/public/meeting-assets/meeting-thumbnails/{recording_id}.jpg`

---

## Cost Estimates

### Monthly Costs by Volume

| Meetings/Month | Microlink | ScreenshotOne | Browserless |
|----------------|-----------|---------------|-------------|
| 50 | **Free** | Free | Free |
| 100 | $9 | **Free** | Free |
| 500 | $9 | $19 | ~$15 |
| 1,000 | $9 | $19 | ~$30 |
| 5,000 | $45 | **$19** | ~$150 |

**Recommendation:**
- <50/month: Use **Microlink** (free)
- 50-100/month: Use **ScreenshotOne** (free)
- 100-5,000/month: Use **ScreenshotOne** ($19/mo best value)
- >5,000/month: Custom solution or negotiate bulk pricing

---

## Troubleshooting

### Thumbnails Not Generating

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

4. **Test API key:**
   ```bash
   # For ScreenshotOne:
   curl "https://api.screenshotone.com/take?access_key=YOUR_KEY&url=https://example.com"

   # For Browserless:
   curl "https://chrome.browserless.io/screenshot?token=YOUR_TOKEN" \
     -X POST -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   ```

### Poor Quality Thumbnails

- Increase wait time (edit `delay` or `waitFor` in Edge Function)
- Try a different service (ScreenshotOne has best quality)
- Increase image quality setting (currently 80%)

### Slow Generation

- Normal: 5-10 seconds per thumbnail
- If >30 seconds: Check service status or try different provider
- Consider batch processing during off-peak hours

---

## Advanced Configuration

### Custom Resolution

Edit `supabase/functions/generate-video-thumbnail/index.ts`:

```typescript
// Change viewport dimensions
viewport_width: '1920',  // Change to desired width
viewport_height: '1080', // Change to desired height
```

### Custom Wait Time

```typescript
delay: '5',      // Seconds to wait (ScreenshotOne)
waitFor: '5000', // Milliseconds (Browserless/Microlink)
```

### Custom Image Quality

```typescript
image_quality: '80', // 1-100 (ScreenshotOne)
quality: 80,         // 1-100 (Browserless)
```

---

## Monitoring

### Check Success Rate

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

### Check Storage Usage

```sql
-- Check storage bucket size
SELECT
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(size)::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'meeting-assets'
GROUP BY bucket_id;
```

---

## Next Steps

1. ✅ Deploy Edge Function
2. ✅ Create storage bucket
3. ✅ Choose and configure screenshot service
4. ✅ Enable feature flag
5. ✅ Test with a single meeting
6. ✅ Re-sync all meetings to generate thumbnails
7. ✅ Monitor success rate and storage usage

---

**Status**: Ready for deployment
**Last Updated**: 2025-10-25
