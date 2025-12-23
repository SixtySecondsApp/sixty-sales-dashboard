# Fathom Video Thumbnail Solution

## Problem Summary
Cross-origin iframes with restrictive headers (X-Frame-Options, CSP) cannot be screenshot by headless browsers. This is a fundamental browser security feature that prevents embedding abuse. Fathom videos have these restrictions, making the iframe approach ineffective.

## Solutions Implemented

### 1. Direct Screenshot Approach (Recommended)
**Implementation**: Modified Browserless function to screenshot Fathom pages directly instead of through an iframe.

**How it works**:
- Navigate directly to the Fathom share URL
- Wait for video element to load and become ready
- Seek to the specified timestamp
- Screenshot either the video element directly or the full viewport

**Benefits**:
- Works with any Fathom URL (public share links)
- No iframe restrictions to bypass
- Cleaner, more reliable approach

**Configuration**:
```bash
# Enable direct mode (recommended)
FORCE_APP_MODE=true  # This now uses direct screenshot instead of iframe
```

### 2. Proxy Server Approach (Alternative)
**Implementation**: Created edge function `/supabase/functions/proxy-fathom-video` that fetches Fathom content and strips restrictive headers.

**How it works**:
- Edge function fetches the Fathom page HTML
- Removes X-Frame-Options and other restrictive headers
- Serves the content with permissive headers
- Browserless screenshots the proxied content

**Benefits**:
- Complete control over the content
- Can modify HTML to ensure video plays
- Works around all embedding restrictions

**Configuration**:
```bash
# Deploy the proxy function
supabase functions deploy proxy-fathom-video

# Enable proxy mode
ENABLE_PROXY_MODE=true
```

### 3. Enhanced Video Detection
**Features added**:
- Multiple attempts (up to 10) to find video element
- Checks video dimensions to ensure it's loaded
- Seeks to specific timestamp before screenshot
- Attempts to screenshot video element directly
- Falls back to viewport screenshot if needed

## Usage Examples

### Direct Screenshot (Recommended)
```javascript
// The edge function now automatically uses direct screenshot when FORCE_APP_MODE=true
const response = await fetch('/api/generate-thumbnail', {
  method: 'POST',
  body: JSON.stringify({
    recording_id: 'abc123',
    share_url: 'https://fathom.video/share/TOKEN',
    fathom_embed_url: 'https://app.fathom.video/recording/ID',
    timestamp_seconds: 30,
    meeting_id: 'meeting-123'
  })
});
```

### With Proxy Mode
```javascript
// Enable proxy mode via environment variable
// ENABLE_PROXY_MODE=true
// Then use the same API call as above
```

## Environment Variables

```bash
# Core settings
BROWSERLESS_URL=https://production-sfo.browserless.io
BROWSERLESS_TOKEN=your-token

# Mode selection (choose one)
FORCE_APP_MODE=true        # Use direct Fathom screenshot (recommended)
ENABLE_PROXY_MODE=true     # Use proxy server approach
USE_DIRECT_MODE=true       # Explicitly use direct mode

# Optional: Disable fallback methods
ONLY_BROWSERLESS=true      # Only use Browserless, no third-party services
DISABLE_THIRD_PARTY_SCREENSHOTS=true  # Skip Microlink, ScreenshotOne, etc.
```

## Troubleshooting

### Issue: Still getting blank screenshots
**Solution**: Ensure you're using direct mode (`FORCE_APP_MODE=true`) which now screenshots Fathom pages directly instead of using iframes.

### Issue: Video not at correct timestamp
**Solution**: The enhanced video detection now waits for video to load and seeks to timestamp. Increase wait times if needed.

### Issue: Screenshot shows full page instead of just video
**Solution**: The function attempts to screenshot just the video element first. If this fails, it falls back to viewport screenshot.

### Issue: Browserless timeout
**Solution**: Fathom pages can be slow. The timeout is set to 90 seconds. Consider using third-party services as fallback.

## Testing

### Test Direct Screenshot
```bash
# Set environment variable
export FORCE_APP_MODE=true

# Test with curl
curl -X POST https://your-supabase-url/functions/v1/generate-video-thumbnail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "recording_id": "test-123",
    "share_url": "https://fathom.video/share/YOUR_TOKEN",
    "fathom_embed_url": "https://app.fathom.video/recording/YOUR_ID",
    "timestamp_seconds": 30
  }'
```

### Expected Logs
```
📸 FORCE_APP_MODE set - Using direct Fathom screenshot...
🎬 Loading Fathom page directly...
✅ Page loaded with networkidle
✅ Video is ready!
⏩ Seeking to timestamp: 30s
✅ Video element screenshot captured!
✅ Direct Fathom screenshot succeeded!
```

## Performance Considerations

1. **Direct Screenshot**: ~10-20 seconds (depends on Fathom page load time)
2. **Proxy Mode**: ~15-25 seconds (additional proxy overhead)
3. **Third-party Services**: ~5-15 seconds (optimized for speed)

## Recommendations

1. **Use Direct Screenshot Mode** (`FORCE_APP_MODE=true`): Most reliable for Fathom videos
2. **Keep Third-party Services as Fallback**: They're faster but may not capture at exact timestamp
3. **Monitor Logs**: The enhanced logging helps identify issues quickly
4. **Test with Different Videos**: Some Fathom videos may have different player configurations

## Architecture Diagram

```
User Request
    ↓
Edge Function (generate-video-thumbnail)
    ↓
Mode Selection:
    ├─→ Direct Mode (RECOMMENDED)
    │     ├─→ Navigate to Fathom URL directly
    │     ├─→ Wait for video element
    │     ├─→ Seek to timestamp
    │     └─→ Screenshot video element
    │
    ├─→ Proxy Mode (Alternative)
    │     ├─→ Proxy edge function fetches Fathom page
    │     ├─→ Strips restrictive headers
    │     ├─→ Serves modified content
    │     └─→ Browserless screenshots proxied page
    │
    └─→ Fallback Options
          ├─→ Third-party services (Microlink, etc.)
          └─→ og:image extraction
    ↓
Upload to S3
    ↓
Return thumbnail URL
```

## Summary

The cross-origin iframe restriction is a fundamental browser security feature that cannot be bypassed conventionally. The solution is to **screenshot the Fathom page directly** instead of trying to embed it in an iframe. This approach is:

1. **More Reliable**: No iframe restrictions to worry about
2. **Simpler**: Direct navigation to the target page
3. **Flexible**: Works with any public Fathom share URL
4. **Maintainable**: No complex workarounds needed

The implementation now automatically uses this direct approach when `FORCE_APP_MODE=true` is set, making it backward compatible with your existing configuration.