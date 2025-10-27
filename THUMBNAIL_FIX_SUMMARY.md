# Fathom Screenshot Timeout Fix - Summary

## Issue
Playwright/Browserless was timing out when trying to generate thumbnails from Fathom videos. The script was attempting to find a `<video>` element on Fathom share pages, but the video is embedded inside an iframe, causing CORS issues and timeouts.

## Root Cause
1. Fathom videos are in iframes on their share pages
2. Cross-origin restrictions prevent accessing iframe content
3. The Playwright script had no timeout protection
4. The script only tried one strategy (finding video element directly)

## Solution Implemented

### 1. Enhanced Browserless Script (Lines 362-432)
Added **5 fallback strategies** to handle iframe structures:

- **Strategy 1**: Check iframes for video content (handles CORS gracefully)
- **Strategy 2**: Look for video element directly on page
- **Strategy 3**: Screenshot viewport if video is in inaccessible iframe
- **Strategy 4**: Try common video container selectors
- **Strategy 5**: Final fallback to viewport screenshot

### 2. Added Timeout Protection (Lines 437-449)
```typescript
const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  // ... handles timeout and cleanup
}
```
Now Browserless calls have a **60-second timeout** to prevent hanging.

### 3. Preferred App Mode (Lines 77-112)
Updated the fallback order to prefer our own MeetingThumbnail page:

**App Mode** (Preferred ✅):
- Screenshots our `/meetings/thumbnail/:meetingId` page
- Video fills entire viewport (no chrome)
- Avoids iframe CORS issues entirely
- Higher success rate

**Fathom Mode** (Fallback):
- Screenshots Fathom pages directly
- Uses improved multi-strategy approach
- May capture extra page content

## Files Changed

### `supabase/functions/generate-video-thumbnail/index.ts`
- Enhanced `captureWithBrowserlessAndUpload` function (lines 332-475)
- Added `fetchWithTimeout` helper (lines 437-449)
- Updated fallback order to prefer app mode (lines 77-112)
- Improved error handling and logging throughout

## Configuration Required

### Environment Variables (if using Browserless)

```bash
# Required for Browserless
supabase secrets set BROWSERLESS_URL=https://chrome.browserless.io
supabase secrets set BROWSERLESS_TOKEN=your_token_here

# Optional - defaults to production if not set
supabase secrets set APP_URL=https://app.sixtyseconds.video
```

## Testing

After deployment, test with:

```bash
# Check logs
supabase functions logs generate-video-thumbnail --tail

# Test thumbnail generation
curl -X POST https://your-project.supabase.co/functions/v1/generate-video-thumbnail \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "123456",
    "share_url": "https://share.fathom.video/...",
    "fathom_embed_url": "https://fathom.video/embed/...",
    "meeting_id": "uuid-here",
    "timestamp_seconds": 30
  }'
```

## Expected Behavior

### With Browserless Configured
1. Microlink tries first (free tier)
2. ScreenshotOne if configured
3. ApiFlash if configured
4. **Browserless App Mode** ✅ (preferred - screenshots our page)
5. Browserless Fathom Mode ✅ (fallback - improved script)
6. og:image fallback
7. Generated placeholder

### Success Indicators
- ✅ `Browserless Playwright succeeded`
- 📸 `Using Browserless Playwright function for app mode`
- 📸 `Using Browserless Playwright function for fathom mode`

### Failure Indicators
- ⚠️ `Screenshot too small` - May indicate iframe issue
- ❌ `Browserless failed` - Check error details in logs
- ⏱️ No timeout errors anymore due to 60s limit

## Benefits

1. ✅ **No more timeouts** - 60-second limit prevents hanging
2. ✅ **Smarter iframe handling** - Multiple strategies increase success rate
3. ✅ **App mode preferred** - Avoids CORS by using our own page
4. ✅ **Better error handling** - Graceful fallbacks at each step
5. ✅ **Always returns something** - Even if not perfect

## Deployment Steps

1. Deploy updated function:
   ```bash
   supabase functions deploy generate-video-thumbnail
   ```

2. Set environment variables (if using Browserless):
   ```bash
   supabase secrets set BROWSERLESS_URL=https://chrome.browserless.io
   supabase secrets set BROWSERLESS_TOKEN=your_token
   supabase secrets set APP_URL=https://app.sixtyseconds.video
   ```

3. Test with a real meeting
4. Monitor logs for success

## Related Documentation

- `THUMBNAIL_TIMEOUT_FIX.md` - Detailed technical explanation
- `PLAYWRIGHT_S3_SETUP.md` - Original Playwright setup
- `VIDEO_THUMBNAIL_SETUP.md` - Complete system overview
- `src/pages/MeetingThumbnail.tsx` - The app mode page

