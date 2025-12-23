# Thumbnail Generation - Debugging Next Steps

## Current Status

✅ **Deployed**: Function is live with enhanced logging
❌ **Testing**: Still failing - need to check logs for root cause

## What We've Done

1. ✅ Simplified Browserless script
2. ✅ Removed `ONLY_BROWSERLESS` restriction  
3. ✅ Removed `DISABLE_THIRD_PARTY_SCREENSHOTS` restriction
4. ✅ Added detailed logging throughout
5. ✅ Deployed multiple times with fixes

## Configuration Verified

```
✅ AWS_ACCESS_KEY_ID - Set
✅ AWS_SECRET_ACCESS_KEY - Set
✅ AWS_S3_BUCKET - Set (user-upload)
✅ AWS_S3_FOLDER - Set (fathom-screenshots)
✅ AWS_REGION - Set (eu-west-2)
✅ BROWSERLESS_TOKEN - Set
✅ BROWSERLESS_URL - Set
```

## Next Step: CHECK THE LOGS

**YOU MUST check the Supabase logs to see the actual error:**

🔗 **[Open Logs Now →](https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/generate-video-thumbnail/logs)**

## What to Look For in Logs

### 1. Microlink Errors
```
Look for:
- "📸 Attempting thumbnail capture with Microlink"
- "❌ Microlink failed" - check what error follows
- "⏱️ Microlink...timed out"
- HTTP status codes from Microlink API
```

### 2. S3 Upload Errors
```
Look for:
- "📤 Starting S3 upload"
- "❌ AWS credentials missing!"
- "Error uploading to S3:"
- S3Client connection errors
```

### 3. Configuration Issues
```
Look for:
- "Config: skipThirdParty=..."
- "📸 Skipping third-party services"
- Environment variable values
```

## Likely Issues

### Issue 1: Microlink Rate Limit
**Symptoms**: "429" or "rate limit" in logs
**Solution**: Wait a few minutes, or sign up for Microlink paid tier

### Issue 2: AWS S3 Credentials Invalid
**Symptoms**: "Access Denied" or "SignatureDoesNotMatch"
**Solution**: Verify AWS credentials in Supabase secrets are correct

### Issue 3: S3 Bucket Permissions
**Symptoms**: "Access Denied" when uploading
**Solution**: Check IAM policy allows `s3:PutObject` on the bucket

### Issue 4: Microlink Timeout
**Symptoms**: Logs show "timeout:microlink"
**Solution**: Fathom pages taking too long to load

## Alternative Solutions

If all screenshot services are failing, here are alternatives:

### Option 1: Use Fathom's og:image (If Available)
The code already tries this, but Fathom may not provide og:image for all videos.

### Option 2: Use Placeholder Thumbnails
Already implemented as final fallback - generates colored squares with initials.

### Option 3: Sign Up for ScreenshotOne
- Cost: $19/month for 5,000 screenshots  
- More reliable than free tier Microlink
- Sign up: https://screenshotone.com
- Set secret: `supabase secrets set SCREENSHOTONE_API_KEY=your_key`

### Option 4: Fix Browserless
If you want to use Browserless (already configured):
1. Get the actual token from Supabase vault
2. Test it directly: 
   ```bash
   curl -X POST "https://chrome.browserless.io/screenshot?token=YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}' \
     --output test.png
   ```
3. If that works, the issue is in our Playwright script
4. If that fails, the token is invalid

## Quick Test Commands

### Test Microlink Directly
```bash
curl "https://api.microlink.io/?url=https://example.com&screenshot=true&meta=false"
```

### Test AWS S3 Upload (from your machine)
```bash
# Get credentials from .env file
AWS_ACCESS_KEY_ID="your_key"
AWS_SECRET="your_secret"

# Try uploading a test file
aws s3 cp test.jpg s3://user-upload/fathom-screenshots/test.jpg \
  --region eu-west-2
```

## What The Logs Will Tell Us

Once you check the logs, you'll see ONE of these:

1. **"📸 Attempting thumbnail capture with Microlink"** → Microlink is trying
   - If followed by ❌, check the error message
   - Could be rate limit, timeout, or API error

2. **"📤 Starting S3 upload"** → Screenshot captured, uploading
   - If followed by ❌, it's an AWS issue
   - Check credentials and permissions

3. **"❌ AWS credentials missing!"** → Environment variables not set properly
   - Redeploy function or check secrets

4. **"Config: skipThirdParty=true"** → Still blocking third-party services
   - Environment variable change didn't take effect
   - Redeploy again

## Action Required

1. **Open the logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/generate-video-thumbnail/logs

2. **Find the latest request** (should be timestamped within last few minutes)

3. **Look for the error messages** listed above

4. **Share the error** or tell me what you see, and I can provide the exact fix

## Files Changed

- `supabase/functions/generate-video-thumbnail/index.ts` - Enhanced with detailed logging
- Environment variables - Removed restrictive flags

## Current Function Behavior

```
Request arrives
  ↓
Try Microlink (free tier)
  ↓ (if fails)
Try ScreenshotOne (if API key set)
  ↓ (if fails)
Try ApiFlash (if API key set)
  ↓ (if fails)
Try Browserless (if configured)
  ↓ (if fails)
Try og:image scraping
  ↓ (if all fail)
Return error: "Failed to capture video thumbnail - all methods exhausted"
```

**The logs will show you exactly which step is failing and why.**

