# Video Thumbnail Generation Options

## Current Situation
- Fathom doesn't provide thumbnails in their API
- We're scraping `og:image` from share pages (often fails)
- Fallback is a generated placeholder with first letter

## Goal
Extract a frame from the actual Fathom video recording to use as thumbnail.

---

## Option 1: Fathom Embed Frame Capture (Client-Side)

**How it works:**
1. Load the Fathom iframe on the server/client
2. Wait for video to load
3. Capture a frame using canvas API
4. Upload to Supabase Storage
5. Store URL in database

**Pros:**
- Uses actual video content
- No external dependencies
- Works with existing Fathom embed URLs

**Cons:**
- Requires headless browser (Puppeteer/Playwright)
- CORS issues may prevent canvas capture
- Slower (need to load full iframe)
- May violate Fathom's terms of service

**Implementation Complexity:** Medium-High

---

## Option 2: Video URL Extraction + FFmpeg

**How it works:**
1. Extract direct video URL from Fathom embed
2. Download first few seconds of video
3. Use FFmpeg to extract frame at 5 seconds
4. Upload to Supabase Storage

**Pros:**
- High quality thumbnails
- Can choose exact timestamp
- Standard video processing approach

**Cons:**
- Need to find/extract actual video URL (may be obfuscated)
- Requires FFmpeg on server
- Video URLs may be authenticated/expire
- May violate Fathom's terms of service

**Implementation Complexity:** High

---

## Option 3: Screenshot Service (Recommended)

**How it works:**
1. Use a screenshot API service to capture Fathom share page
2. Service handles rendering and capture
3. Store resulting image URL

**Services:**
- **ScreenshotOne.com** - $19/mo for 5,000 screenshots
- **ApiFlash.com** - $12/mo for 1,000 screenshots
- **Urlbox.io** - $19/mo for 5,000 screenshots
- **Microlink.io** - Free tier available

**Pros:**
- No server-side rendering needed
- Handles CORS and authentication
- Fast and reliable
- Legal and within ToS

**Cons:**
- External service dependency
- Monthly cost
- Not the actual video frame (just page screenshot)

**Implementation Complexity:** Low

---

## Option 4: Supabase Edge Function + Puppeteer

**How it works:**
1. Supabase Edge Function with Puppeteer
2. Navigate to Fathom embed URL
3. Wait for video player to load
4. Take screenshot
5. Upload to Supabase Storage

**Pros:**
- All within Supabase ecosystem
- Full control over capture process
- Can capture actual video frame

**Cons:**
- Puppeteer adds significant function size
- May be slow (cold starts)
- Fathom may detect/block automated access

**Implementation Complexity:** Medium

---

## Option 5: Use Fathom's Internal Thumbnail API (Investigate)

**How it works:**
1. Check if Fathom has an undocumented thumbnail endpoint
2. Pattern: `https://thumbnails.fathom.video/{recording_id}.jpg`
3. Or check if embedded player exposes thumbnail URLs

**Pros:**
- Official Fathom thumbnails
- Fast and reliable
- No processing needed

**Cons:**
- May not exist or be public
- Could change without notice

**Implementation Complexity:** Low (if exists)

---

## Recommended Approach

### Phase 1: Quick Win (Immediate)
**Try Fathom's potential thumbnail endpoints:**

```typescript
// Test these patterns:
const thumbnailPatterns = [
  `https://thumbnails.fathom.video/${recordingId}.jpg`,
  `https://cdn.fathom.video/thumbnails/${recordingId}.jpg`,
  `https://fathom.video/api/thumbnails/${recordingId}`,
  `https://app.fathom.video/thumbnails/${recordingId}.jpg`,
]

// Try each URL, if any returns 200, use it
```

### Phase 2: Screenshot Service (Recommended)
If Phase 1 fails, use **Microlink.io** (has free tier):

```typescript
async function generateThumbnailWithMicrolink(shareUrl: string): Promise<string | null> {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(shareUrl)}&screenshot=true&meta=false`

  const response = await fetch(apiUrl)
  const data = await response.json()

  return data?.screenshot?.url || null
}
```

### Phase 3: Puppeteer (Advanced)
If you need actual video frames and have budget, implement Puppeteer solution.

---

## Implementation Plan

### Step 1: Test Fathom Thumbnail Endpoints
```typescript
async function fetchFathomThumbnail(recordingId: string, shareUrl: string): Promise<string | null> {
  // Try direct thumbnail patterns
  const patterns = [
    `https://thumbnails.fathom.video/${recordingId}.jpg`,
    `https://thumbnails.fathom.video/${recordingId}.png`,
    `https://cdn.fathom.video/thumbnails/${recordingId}.jpg`,
  ]

  for (const url of patterns) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        console.log(`✅ Found Fathom thumbnail: ${url}`)
        return url
      }
    } catch (e) {
      // Continue to next pattern
    }
  }

  // Try scraping video poster image from embed
  try {
    const embedUrl = `https://fathom.video/embed/${extractId(shareUrl)}`
    const response = await fetch(embedUrl)
    const html = await response.text()

    // Look for video poster attribute
    const posterMatch = html.match(/poster=["']([^"']+)["']/i)
    if (posterMatch) return posterMatch[1]

    // Look for video thumbnail in player metadata
    const thumbMatch = html.match(/thumbnail["']?\s*:\s*["']([^"']+)["']/i)
    if (thumbMatch) return thumbMatch[1]
  } catch (e) {
    // Continue to fallback
  }

  return null
}
```

### Step 2: Integrate Microlink (Fallback)
```typescript
async function generateThumbnailWithMicrolink(shareUrl: string): Promise<string | null> {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(shareUrl)}&screenshot=true&meta=false&viewport.width=1280&viewport.height=720`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) return null

    const data = await response.json()
    return data?.data?.screenshot?.url || null
  } catch (e) {
    console.error('Microlink thumbnail generation failed:', e)
    return null
  }
}
```

### Step 3: Update Sync Function
```typescript
// In syncSingleCall function:
let thumbnailUrl = null

// Try 1: Fathom's potential thumbnail endpoints
thumbnailUrl = await fetchFathomThumbnail(call.recording_id, call.share_url)

// Try 2: Scrape og:image
if (!thumbnailUrl) {
  thumbnailUrl = await fetchThumbnailFromShareUrl(call.share_url)
}

// Try 3: Microlink screenshot service (if enabled)
if (!thumbnailUrl && Deno.env.get('ENABLE_MICROLINK_THUMBNAILS') === 'true') {
  thumbnailUrl = await generateThumbnailWithMicrolink(call.share_url)
}

// Try 4: Generated placeholder (last resort)
if (!thumbnailUrl) {
  const firstLetter = (call.title || 'M')[0].toUpperCase()
  thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
}
```

---

## Cost Comparison

| Service | Free Tier | Paid Plan | Cost per 1000 |
|---------|-----------|-----------|---------------|
| Microlink | 50/day | $9/mo for 10k | $0.90 |
| ScreenshotOne | 100/mo | $19/mo for 5k | $3.80 |
| ApiFlash | 100/mo | $12/mo for 1k | $12.00 |
| Urlbox | No free | $19/mo for 5k | $3.80 |
| Placeholder (current) | Unlimited | Free | $0 |

---

## Next Steps

1. **Test Fathom thumbnail patterns** - Quick investigation
2. **Implement Microlink integration** - If Phase 1 fails
3. **Add environment variable** - `ENABLE_MICROLINK_THUMBNAILS`
4. **Monitor usage** - Track thumbnail success rates

Would you like me to implement Phase 1 (testing Fathom's potential thumbnail endpoints) first?
