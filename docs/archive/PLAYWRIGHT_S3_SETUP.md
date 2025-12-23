# Playwright + AWS S3 Thumbnail System

## Overview

The thumbnail generation system now uses **Playwright** (built-in browser automation) + **AWS S3** storage. No external screenshot services needed!

**Key Benefits:**
- ✅ **No additional costs** - Uses Playwright (already available)
- ✅ **Full control** - Direct browser automation
- ✅ **Fast & reliable** - Native Chromium rendering
- ✅ **Unlimited usage** - No API rate limits
- ✅ **AWS S3 storage** - Scalable, cost-effective (~$1/month for 1000 thumbnails)

---

## Cost Breakdown

### For 1000 Thumbnails:

**Screenshot Capture:**
- ✅ **FREE** - Playwright runs in Supabase Edge Functions (no additional cost)

**AWS S3 Storage:**
- Storage: $0.023/month
- Upload: $0.005 (one-time)
- Bandwidth: ~$0.90/month
- **Total: ~$0.93/month**

**TOTAL MONTHLY COST: ~$1/month** 🎉

Compare to external services:
- ScreenshotOne: $19/month
- Browserless: $30/month
- Microlink: $90/month

**Savings: $18-89/month!**

---

## How It Works

```
┌─────────────────┐
│  Fathom Sync   │
│  Function      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ generate-video- │
│ thumbnail       │
│ Edge Function   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Playwright     │
│  (Chromium)     │
│  Launches       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Navigate to    │
│  Fathom Embed   │
│  Wait 5 sec     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Capture        │
│  Screenshot     │
│  (1920x1080)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Upload to      │
│  AWS S3         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Public  │
│  S3 URL         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store in       │
│  meetings.      │
│  thumbnail_url  │
└─────────────────┘
```

---

## Setup (10 minutes)

### Step 1: Create AWS S3 Bucket (5 min)

1. **Go to AWS S3 Console**: https://s3.console.aws.amazon.com/s3/buckets

2. **Create Bucket:**
   - Click "Create bucket"
   - **Bucket name**: `sixty-sales-meeting-thumbnails` (must be globally unique)
   - **AWS Region**: `us-east-1` (or your preferred region)
   - **Block Public Access**: ⚠️ **UNCHECK** "Block all public access"
     - We need public read access for thumbnail URLs
     - Check the acknowledgment box
   - Click "Create bucket"

3. **Configure Bucket Policy for Public Read:**
   - Click on your bucket name
   - Go to "Permissions" tab
   - Scroll to "Bucket policy"
   - Click "Edit" and paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::sixty-sales-meeting-thumbnails/*"
       }
     ]
   }
   ```

   - Click "Save changes"

4. **Enable CORS:**
   - Still in "Permissions" tab
   - Scroll to "Cross-origin resource sharing (CORS)"
   - Click "Edit" and paste:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   - Click "Save changes"

### Step 2: Create IAM User (3 min)

1. **Go to IAM Console**: https://console.aws.amazon.com/iam/home#/users

2. **Create User:**
   - Click "Add users"
   - **User name**: `sixty-sales-thumbnail-uploader`
   - **Access type**: Check "Programmatic access"
   - Click "Next: Permissions"

3. **Attach Policy:**
   - Select "Attach existing policies directly"
   - Click "Create policy"
   - Choose "JSON" tab and paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:PutObjectAcl",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::sixty-sales-meeting-thumbnails/*"
       }
     ]
   }
   ```

   - Click "Next: Tags" (skip)
   - Click "Next: Review"
   - **Policy name**: `SixtySalesThumbnailUpload`
   - Click "Create policy"

4. **Complete User Creation:**
   - Go back to user creation tab
   - Click refresh button next to "Create policy"
   - Search for `SixtySalesThumbnailUpload` and check it
   - Click "Next: Tags" (skip)
   - Click "Next: Review"
   - Click "Create user"

5. **Save Credentials:**
   - ⚠️ **IMPORTANT**: Download CSV or copy credentials now
   - You'll need:
     - **Access key ID**: `AKIA...`
     - **Secret access key**: `wJalrXUtn...`
   - You won't be able to see the secret key again!

### Step 3: Configure Supabase Secrets (2 min)

```bash
# Set AWS credentials
supabase secrets set AWS_ACCESS_KEY_ID="your_access_key_id"
supabase secrets set AWS_SECRET_ACCESS_KEY="your_secret_access_key"
supabase secrets set AWS_S3_BUCKET="sixty-sales-meeting-thumbnails"
supabase secrets set AWS_REGION="us-east-1"

# Verify secrets are set
supabase secrets list
```

**That's it!** No screenshot service API keys needed.

---

## Testing

### Test Thumbnail Generation

```bash
curl -X POST \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/generate-video-thumbnail" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
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
  "thumbnail_url": "https://sixty-sales-meeting-thumbnails.s3.us-east-1.amazonaws.com/meeting-thumbnails/96397021.jpg",
  "recording_id": "96397021"
}
```

### Monitor Edge Function Logs

```bash
supabase functions logs generate-video-thumbnail --tail
```

You should see:
```
🎭 Launching Playwright browser...
📺 Navigating to: https://fathom.video/embed/...
⏳ Waiting for video player to load...
📸 Capturing screenshot...
✅ Screenshot captured successfully
📤 Uploading to AWS S3: sixty-sales-meeting-thumbnails/meeting-thumbnails/96397021.jpg
✅ Uploaded to S3: https://...
```

---

## Performance

### Single Thumbnail Generation:
- Browser launch: ~2-3 seconds
- Page load + wait: ~5-7 seconds
- Screenshot capture: ~1 second
- S3 upload: ~1 second
- **Total: ~9-12 seconds per thumbnail**

### Bulk Processing (1000 thumbnails):
- Sequential: ~9-12 seconds each = 2.5-3.5 hours total
- Can be optimized with parallel processing in fathom-sync function

---

## Advantages Over External Services

| Feature | Playwright | External Services |
|---------|-----------|-------------------|
| **Cost** | FREE ✅ | $19-90/month |
| **Rate Limits** | None ✅ | 50-5000/month |
| **Setup** | Just AWS S3 ✅ | AWS S3 + API keys |
| **Control** | Full control ✅ | Limited |
| **Quality** | Native browser ✅ | Varies |
| **Customization** | Unlimited ✅ | Limited |
| **Dependencies** | None ✅ | External API |

---

## Troubleshooting

### Playwright browser not launching?

Check Edge Function logs:
```bash
supabase functions logs generate-video-thumbnail --tail
```

Common issues:
- Memory limits in Edge Function (increase if needed)
- Timeout errors (increase waitUntil timeout)
- Missing browser dependencies (should be included in Playwright for Deno)

### Screenshots are blank?

- Increase wait time before screenshot (currently 5 seconds)
- Check if video player selector is correct
- Verify embed URL is accessible

### S3 upload failures?

- Verify AWS credentials are correct
- Check IAM policy has `s3:PutObject` permission
- Ensure bucket name is correct
- Verify bucket policy allows public read

---

## Customization

### Adjust Screenshot Quality

Edit `supabase/functions/generate-video-thumbnail/index.ts`:

```typescript
const screenshot = await page.screenshot({
  type: 'jpeg',
  quality: 90, // Increase for better quality (80-100)
  fullPage: false,
})
```

### Adjust Wait Time

```typescript
await page.waitForTimeout(8000) // Wait 8 seconds instead of 5
```

### Change Viewport Size

```typescript
const context = await browser.newContext({
  viewport: { width: 2560, height: 1440 }, // 2K resolution
  deviceScaleFactor: 1,
})
```

---

## Deployment Checklist

- [ ] Create S3 bucket with public read access
- [ ] Configure bucket policy and CORS
- [ ] Create IAM user with upload permissions
- [ ] Set Supabase secrets (AWS credentials)
- [ ] Edge Function deployed (already done ✅)
- [ ] Test thumbnail generation
- [ ] Verify S3 upload works
- [ ] Verify public URL is accessible
- [ ] Re-sync Fathom meetings

---

## Next Steps

1. ✅ Create S3 bucket (5 minutes)
2. ✅ Create IAM user (3 minutes)
3. ✅ Set Supabase secrets (2 minutes)
4. 🧪 Test thumbnail generation
5. 🔄 Re-sync Fathom meetings

Then all 1000 thumbnails will be generated for **~$1/month** with no additional service costs! 🎉

---

## Summary

**Before (with ScreenshotOne):**
- Cost: $19.93/month
- Setup: 4 steps (S3, IAM, secrets, screenshot service)
- Dependencies: External API

**After (with Playwright):**
- Cost: $0.93/month ✅
- Setup: 3 steps (S3, IAM, secrets)
- Dependencies: None ✅

**Savings: $19/month = $228/year!** 💰

---

**Quick Reference:**
- S3 Console: https://s3.console.aws.amazon.com/s3/buckets
- IAM Console: https://console.aws.amazon.com/iam
- Edge Function Logs: `supabase functions logs generate-video-thumbnail --tail`
- Supabase Dashboard: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
