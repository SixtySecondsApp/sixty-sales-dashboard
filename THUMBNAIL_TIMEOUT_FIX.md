# Fathom Screenshot Timeout Fix

## Problem

When generating thumbnails for Fathom videos, Playwright/Browserless was timing out because:

1. **Iframe CORS Issues**: Fathom videos are embedded in iframes on their share pages
2. **Element Not Found**: The Playwright script was looking for a `<video>` element on the Fathom page itself, but the video is inside an iframe that cannot be accessed due to CORS restrictions
3. **No Timeout Protection**: The fetch call to Browserless had no timeout, causing it to hang indefinitely

## Solution

Implemented multiple improvements to handle the iframe structure and prevent timeouts:

### 1. **Improved Browserless Script** (`captureWithBrowserlessAndUpload`)

The script now uses multiple fallback strategies:

**Strategy 1**: Check iframes for video content
- Attempts to access iframe content and find video elements
- Handles CORS errors gracefully

**Strategy 2**: Look for video element directly on page
- Falls back to direct video element if no iframes found

**Strategy 3**: Screenshot viewport if video is in inaccessible iframe
- Captures the entire page if iframe content cannot be accessed

**Strategy 4**: Try common video container selectors
- Looks for `[class*="video-player"]`, `[class*="player"]`, `[data-video]`, etc.
- Validates container size before screenshot

**Strategy 5**: Final fallback to viewport screenshot
- Always returns a screenshot, even if not optimized

### 2. **Added Timeout Protection**

```typescript
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}
```

Now the Browserless call has a 60-second timeout to prevent hanging.

### 3. **Preferred App Mode**

Updated the fallback order to prefer "app mode" over "fathom mode":

**App Mode** (Preferred):
- Screenshots our own `/meetings/thumbnail/:meetingId` page
- This page renders the video full-screen without extra chrome
- Avoids iframe CORS issues entirely
- URL: `https://app.sixtyseconds.video/meetings/thumbnail/{meeting_id}?shareUrl=...&recordingId=...&t=30`

**Fathom Mode** (Fallback):
- Screenshots Fathom pages directly
- Uses the improved multi-strategy approach to handle iframes
- May capture more page content than intended

## Configuration

### Environment Variables

Add to Supabase secrets if using Browserless:

```bash
# Browserless configuration
supabase secrets set BROWSERLESS_URL=https://chrome.browserless.io
supabase secrets set BROWSERLESS_TOKEN=your_token_here

# App URL for app mode screenshots (optional, defaults to production)
supabase secrets set APP_URL=https://app.sixtyseconds.video
```

### Fallback Order

1. **Microlink** (free tier available) - tries video selectors with multiple wait times
2. **ScreenshotOne** (if API key configured) - professional screenshot service
3. **ApiFlash** (if API key configured) - alternative screenshot service
4. **Browserless App Mode** (if configured) - screenshots our MeetingThumbnail page ✅ NEW
5. **Browserless Fathom Mode** (if configured) - screenshots Fathom pages with improved script ✅ IMPROVED
6. **og:image fallback** - scrapes thumbnail from Fathom share page
7. **Generated placeholder** - ASCII letter on colored background

## Testing

### Test Browserless App Mode

```bash
# Generate thumbnail for a specific meeting
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

### Test Browserless Fathom Mode

```bash
# Test without meeting_id to trigger fathom mode
curl -X POST https://your-project.supabase.co/functions/v1/generate-video-thumbnail \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "123456",
    "share_url": "https://share.fathom.video/...",
    "fathom_embed_url": "https://fathom.video/embed/...",
    "timestamp_seconds": 30
  }'
```

## Expected Results

### App Mode (Preferred)
- Screenshot of video player filling entire viewport
- Clean, no extra page chrome
- High success rate (no CORS issues)

### Fathom Mode (Fallback)
- Screenshot of Fathom share page
- May include some page chrome (headers, buttons, etc.)
- Lower success rate due to iframe limitations
- Uses improved multi-strategy approach

## Deployment

1. **Deploy the updated edge function**:
   ```bash
   supabase functions deploy generate-video-thumbnail
   ```

2. **Set environment variables** (if not already set):
   ```bash
   supabase secrets set BROWSERLESS_URL=https://chrome.browserless.io
   supabase secrets set BROWSERLESS_TOKEN=your_token
   supabase secrets set APP_URL=https://app.sixtyseconds.video
   ```

3. **Test with a real meeting**:
   - Navigate to a meeting detail page
   - Verify thumbnail is generated (check network tab)
   - Check logs: `supabase functions logs generate-video-thumbnail --tail`

## Monitoring

Check logs for success indicators:

```bash
supabase functions logs generate-video-thumbnail --tail
```

Look for:
- ✅ `Browserless Playwright succeeded` - Screenshot captured successfully
- 📸 `Using Browserless Playwright function for app mode` - App mode in use
- 📸 `Using Browserless Playwright function for fathom mode` - Fathom mode in use
- ⚠️ `Screenshot too small` - Screenshot captured but suspiciously small
- ❌ `Browserless failed` - Check error message for details

## Key Improvements

1. ✅ **No more timeouts** - 60-second timeout on fetch calls
2. ✅ **Smarter iframe handling** - Multiple strategies to find video content
3. ✅ **App mode preferred** - Avoids CORS by using our own page
4. ✅ **Better error handling** - Graceful fallbacks at each step
5. ✅ **Always returns something** - Even if not perfect, returns a screenshot

## File Changes

- `supabase/functions/generate-video-thumbnail/index.ts`
  - Enhanced `captureWithBrowserlessAndUpload` function
  - Added `fetchWithTimeout` helper
  - Updated fallback order to prefer app mode
  - Improved error handling and logging

## Related Documentation

- `PLAYWRIGHT_S3_SETUP.md` - Original Playwright setup guide
- `VIDEO_THUMBNAIL_SETUP.md` - Complete thumbnail system overview
- `src/pages/MeetingThumbnail.tsx` - The app mode page being screenshot

