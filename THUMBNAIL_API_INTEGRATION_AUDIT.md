# Thumbnail API Integration Audit

## 🎯 Goal
Replace complex screenshot logic with a simple call to your existing API:
- API endpoint: `https://pnip1dhixe.execute-api.eu-west-2.amazonaws.com/fathom-thumbnail-generator/thumbnail`
- Input: `{"fathom_url": "https://fathom.video/share/..."}`
- Output: `{"http_url": "https://fathom-thumbnail.s3.eu-west-2.amazonaws.com/thumbnails/..."}`

## 📋 Current Code Analysis

### File: `supabase/functions/generate-video-thumbnail/index.ts`

**Current Flow (832 lines):**
```
1. Parse request (recording_id, share_url, fathom_embed_url, meeting_id) [Lines 55-76]
2. Try App Mode (Browserless) [Lines 165-191]
3. Try Microlink [Lines 193-199]
4. Try ScreenshotOne [Lines 203-208]
5. Try ApiFlash [Lines 212-217]
6. Try Browserless Fathom mode [Lines 225-240]
7. Try og:image scraping [Lines 243-245]
8. Upload to S3 (YOUR bucket) [Lines 776-831]
9. Return thumbnail URL [Lines 272-283]
```

**Functions to Remove/Replace:**
- `captureWithMicrolink()` [Lines 330-409] - 80 lines
- `captureWithScreenshotOne()` [Lines 711-738] - 28 lines
- `captureWithApiFlash()` [Lines 743-771] - 29 lines
- `captureWithBrowserlessAndUpload()` [Lines 416-671] - 256 lines
- `captureViaProviderAndUpload()` [Lines 676-683] - 8 lines
- `uploadToStorage()` [Lines 776-831] - 56 lines (keep as fallback)

**Total lines to remove: ~400 lines**

---

## ✅ Minimal Change Implementation

### What Changes
**Only 1 function to add** (~30 lines):
```typescript
async function captureWithCustomAPI(
  shareUrl: string,
  recordingId: string
): Promise<string | null> {
  try {
    const apiUrl = 'https://pnip1dhixe.execute-api.eu-west-2.amazonaws.com/fathom-thumbnail-generator/thumbnail'
    
    console.log(`📸 Calling custom thumbnail API...`)
    console.log(`   Share URL: ${shareUrl}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fathom_url: shareUrl }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Custom API error: ${response.status} - ${errorText}`)
      return null
    }
    
    const data = await response.json()
    
    if (data.http_url) {
      console.log(`✅ Thumbnail generated via custom API`)
      console.log(`   URL: ${data.http_url}`)
      return data.http_url
    }
    
    console.error('❌ Custom API returned no http_url')
    return null
  } catch (error) {
    console.error('❌ Custom API exception:', error.message)
    return null
  }
}
```

**Main flow update** (Lines 147-250):
```typescript
// BEFORE (complex multi-provider logic):
if (!thumbnailUrl && appUrl && Deno.env.get('BROWSERLESS_URL')) {
  thumbnailUrl = await captureWithBrowserlessAndUpload(...)
}
if (!thumbnailUrl && !skipThirdParty) {
  thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'microlink')
  if (!thumbnailUrl) {
    thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'screenshotone')
  }
  if (!thumbnailUrl) {
    thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'apiflash')
  }
}
if (!thumbnailUrl && Deno.env.get('BROWSERLESS_URL') && !forceAppMode) {
  thumbnailUrl = await captureWithBrowserlessAndUpload(...)
}
if (!thumbnailUrl && shareWithTs) {
  thumbnailUrl = await fetchThumbnailFromShareUrl(shareWithTs)
}

// AFTER (simple single call):
// Try custom API first (already uploads to S3)
if (!thumbnailUrl && normalizedShareUrl) {
  thumbnailUrl = await captureWithCustomAPI(normalizedShareUrl, recording_id)
}

// Fallback to og:image scraping if custom API fails
if (!thumbnailUrl && shareWithTs) {
  thumbnailUrl = await fetchThumbnailFromShareUrl(shareWithTs)
}
```

### What Stays Unchanged
- Request parsing [Lines 55-76] ✅
- URL normalization [Lines 94-145] ✅
- Response handling [Lines 255-297] ✅
- Database update logic [Lines 256-270] ✅
- og:image scraping as fallback [Lines 688-706] ✅
- Error handling [Lines 284-297] ✅

---

## 📊 Impact Analysis

### Lines Changed
| Section | Before | After | Change |
|---------|--------|-------|--------|
| Imports | 3 | 2 | -1 (remove S3Client) |
| Main logic | ~100 | ~30 | -70 |
| Helper functions | ~500 | ~50 | -450 |
| **Total** | **832** | **~350** | **-480 lines** |

### Dependencies Removed
```typescript
// REMOVE:
import { S3Client, PutObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
```

### Environment Variables No Longer Needed
- ❌ `AWS_ACCESS_KEY_ID`
- ❌ `AWS_SECRET_ACCESS_KEY`
- ❌ `AWS_S3_BUCKET`
- ❌ `AWS_REGION`
- ❌ `AWS_S3_FOLDER`
- ❌ `BROWSERLESS_URL`
- ❌ `BROWSERLESS_TOKEN`
- ❌ `SCREENSHOTONE_API_KEY`
- ❌ `APIFLASH_API_KEY`
- ❌ `APP_URL`
- ✅ Keep: `ENABLE_VIDEO_THUMBNAILS`

### Performance Improvement
- **Before:** 15-90 seconds (depending on provider, retries)
- **After:** ~5-10 seconds (single API call)

### Reliability Improvement
- **Before:** Multiple points of failure (5+ services)
- **After:** Single point of failure (your API, which already works)

---

## 🔧 Implementation Steps

### Step 1: Create New Simplified Function
Create: `supabase/functions/generate-video-thumbnail-v2/index.ts`

Why new file:
- Keep old version as backup
- Test new version in parallel
- Easy rollback if needed
- No disruption to existing system

### Step 2: Test New Function
```bash
# Deploy new function
supabase functions deploy generate-video-thumbnail-v2

# Test it
curl -X POST \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/generate-video-thumbnail-v2" \
  -H "Authorization: Bearer $VITE_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "test-123",
    "share_url": "https://fathom.video/share/PYNL_B2iVxpxD_J_zFTkkhsXpV91saWV",
    "fathom_embed_url": "https://fathom.video/embed/PYNL_B2iVxpxD_J_zFTkkhsXpV91saWV"
  }'
```

Expected response:
```json
{
  "success": true,
  "thumbnail_url": "https://fathom-thumbnail.s3.eu-west-2.amazonaws.com/thumbnails/20251030_074836_cda7e5a6.jpg",
  "recording_id": "test-123"
}
```

### Step 3: Update Callers (Optional)
If new function works, update callers to use `-v2`:
- `fathom-sync/index.ts` line 102
- `src/components/meetings/MeetingDetail.tsx` line 275
- `src/pages/MeetingDetail.tsx` line 283
- `src/components/meetings/MeetingsList.tsx` line 166

Or just rename `-v2` to replace the original.

---

## 🎯 Recommendation

**Approach: Side-by-side deployment**
1. Create new simplified function (`generate-video-thumbnail-v2`)
2. Test thoroughly with real data
3. Switch callers to use `-v2`
4. Delete old function after verification

**Benefits:**
- Zero downtime
- Easy rollback
- No disruption to existing thumbnails
- Can compare old vs new side-by-side

---

## 📝 Code to Write

### New Function Structure (~350 lines total)
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = { /* ... */ }

// Helper: Normalize Fathom share URL
function normalizeFathomShareUrl(shareUrl: string): string { /* ... */ }

// NEW: Call your custom API
async function captureWithCustomAPI(shareUrl: string, recordingId: string): Promise<string | null> {
  // ~30 lines
}

// KEEP: Fallback og:image scraping
async function fetchThumbnailFromShareUrl(shareUrl: string): Promise<string | null> {
  // ~20 lines
}

// Main handler
serve(async (req) => {
  // Parse request
  // Try custom API
  // Fallback to og:image
  // Update database
  // Return response
})
```

---

## ✅ Next Steps

Shall I:
1. **Create the new simplified function** (`generate-video-thumbnail-v2/index.ts`) with your API integration?
2. **Test it** with the sample Fathom URL you provided?
3. **Provide instructions** to switch over once verified?

This keeps your existing function untouched and allows safe testing.


