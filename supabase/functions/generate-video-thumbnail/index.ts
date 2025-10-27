import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Video Thumbnail Generator Edge Function
 *
 * Captures a screenshot from a Fathom video embed using Playwright and uploads to AWS S3
 *
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_S3_BUCKET
 * - AWS_REGION (optional, defaults to us-east-1)
 */

interface ThumbnailRequest {
  recording_id: string
  share_url: string
  fathom_embed_url: string
  // Optional: capture at a specific second in the video if supported by the player
  timestamp_seconds?: number
  // Optional: if provided, persist thumbnail_url directly to DB with service role
  meeting_id?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recording_id, share_url, fathom_embed_url, timestamp_seconds, meeting_id }: ThumbnailRequest = await req.json()

    if (!recording_id || !fathom_embed_url) {
      throw new Error('Missing required fields: recording_id and fathom_embed_url')
    }

    console.log(`📸 Generating thumbnail for recording ${recording_id}...`)
    console.log(`📺 Embed URL: ${fathom_embed_url}`)

    // Capture screenshot and upload to storage (AWS S3 or Supabase)
    // Append timestamp param if provided to jump the embed/share to a specific time
    const embedWithTs = typeof timestamp_seconds === 'number' && timestamp_seconds > 0
      ? (() => {
          try {
            const u = new URL(fathom_embed_url)
            u.searchParams.set('timestamp', String(Math.floor(timestamp_seconds)))
            // Nudge player to show frame at timestamp without starting playback
            u.searchParams.set('autoplay', '0')
            return u.toString()
          } catch {
            return fathom_embed_url
          }
        })()
      : fathom_embed_url

    // Prefer the public share URL for both og:image and screenshots
    const shareWithTs = share_url
      ? (() => { try {
            const u = new URL(share_url)
            if (typeof timestamp_seconds === 'number' && timestamp_seconds > 0) {
              u.searchParams.set('timestamp', String(Math.floor(timestamp_seconds)))
            }
            return u.toString()
          } catch { return share_url } })()
      : null

    // Try screenshot providers (self-hosted preferred), then fallback to og:image
    const targetUrl = shareWithTs || embedWithTs

    let thumbnailUrl: string | null = null

    const onlyBrowserless = (Deno.env.get('ONLY_BROWSERLESS') || Deno.env.get('DISABLE_THIRD_PARTY_SCREENSHOTS')) === 'true'

    // A) Self-hosted Browserless (preferred, no per-call vendor cost)
    thumbnailUrl = await captureWithBrowserlessAndUpload(targetUrl, recording_id)

    if (!onlyBrowserless) {
      // B) Microlink screenshot
      if (!thumbnailUrl) {
        thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'microlink')
      }

      // C) ScreenshotOne
      if (!thumbnailUrl) {
        thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'screenshotone')
      }

      // D) APIFLASH
      if (!thumbnailUrl) {
        thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'apiflash')
      }
    }

    // E) Last resort: og:image (often unavailable per user)
    if (!thumbnailUrl && shareWithTs) {
      thumbnailUrl = await fetchThumbnailFromShareUrl(shareWithTs)
    }

    if (!thumbnailUrl) {
      throw new Error('Failed to capture video thumbnail')
    }

    console.log(`✅ Thumbnail generated: ${thumbnailUrl}`)

    // If meeting_id is provided, persist to DB using service role
    let dbUpdated = false
    if (meeting_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', meeting_id)
        if (!updateError) dbUpdated = true
      } catch (e) {
        console.warn('⚠️ Failed to persist thumbnail_url via service role:', e)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        thumbnail_url: thumbnailUrl,
        recording_id,
        db_updated: dbUpdated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Thumbnail generation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Capture video thumbnail using screenshot service and upload to storage
 */
async function captureVideoThumbnail(
  url: string,
  recordingId: string
): Promise<string | null> {
  try {
    console.log('📸 Capturing screenshot...')

    // Try providers in code above instead
    let imageBuffer: ArrayBuffer | null = await captureWithMicrolink(url)

    if (!imageBuffer) {
      throw new Error('Failed to capture screenshot with all providers')
    }

    // Upload to AWS S3
    return await uploadToStorage(imageBuffer, recordingId)

  } catch (error) {
    console.error('Error capturing thumbnail:', error)
    return null
  }
}

/**
 * Capture screenshot using Microlink API (free tier)
 * Try multiple strategies: video element selector, then full page with overlay hiding
 */
async function captureWithMicrolink(
  url: string
): Promise<ArrayBuffer | null> {
  // Strategy 1: Try to capture ONLY the <video> tag, not containers
  // The video tag itself should have the actual video content
  const videoSelectors = [
    'video',                     // Direct video tag (MOST IMPORTANT)
    'video-player video',        // Video inside custom element
    'section video',             // Video inside section
    'div.relative video',        // Video in relative positioned div
    '[class*="video-"]',         // Any class with video- prefix
    'video-player',              // Last resort: custom element (captures whole page)
  ]

  for (const selector of videoSelectors) {
    try {
      // Use Microlink's element hiding feature to isolate the video
      const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
        url,
        screenshot: 'true',
        meta: 'false',
        'viewport.width': '1920',
        'viewport.height': '1080',
        'viewport.deviceScaleFactor': '2',
        waitFor: '10000',
        // Capture ONLY the video element, nothing else
        'screenshot.element': selector,
        // Hide all overlay UI elements
        'screenshot.overlay.browser': 'false',
        'screenshot.overlay.background': 'transparent',
        // Remove scrollbars and UI chrome
        'screenshot.scrollElement': 'false'
      }).toString()

      console.log(`📡 Trying Microlink with selector: ${selector}`)

      const response = await fetch(microlinkUrl)

      if (!response.ok) {
        console.log(`Microlink failed for selector "${selector}": ${response.status}`)
        continue // Try next selector
      }

      const data = await response.json()
      const screenshotUrl = data?.data?.screenshot?.url

      if (!screenshotUrl) {
        console.log(`No screenshot URL for selector "${selector}"`)
        continue // Try next selector
      }

      // Download the screenshot
      console.log(`📥 Downloading screenshot from: ${screenshotUrl}`)
      const imageResponse = await fetch(screenshotUrl)

      if (!imageResponse.ok) {
        console.log(`Failed to download screenshot: ${imageResponse.status}`)
        continue // Try next selector
      }

      const imageBuffer = await imageResponse.arrayBuffer()

      // Check if image is reasonable size (not tiny placeholder)
      if (imageBuffer.byteLength > 10000) { // At least 10KB
        console.log(`✅ Screenshot captured with selector "${selector}" (${imageBuffer.byteLength} bytes)`)
        return imageBuffer
      } else {
        console.log(`Screenshot too small with selector "${selector}", trying next...`)
      }
    } catch (error) {
      console.log(`Error with selector "${selector}":`, error)
      continue // Try next selector
    }
  }

  // Strategy 2: If all selectors fail, capture full page (fallback)
  try {
    console.log('📡 Falling back to full page screenshot...')
    const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'false',
      'viewport.width': '1920',
      'viewport.height': '1080',
      'viewport.deviceScaleFactor': '1',
      waitFor: '8000',
      // Capture full page as last resort
      'screenshot.fullPage': 'false',
    }).toString()

    const response = await fetch(microlinkUrl)

    if (!response.ok) {
      console.error(`Microlink full page screenshot failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    const screenshotUrl = data?.data?.screenshot?.url

    if (!screenshotUrl) {
      console.error('No screenshot URL in Microlink response')
      return null
    }

    const imageResponse = await fetch(screenshotUrl)
    if (!imageResponse.ok) {
      console.error(`Failed to download screenshot: ${imageResponse.status}`)
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    console.log(`✅ Full page screenshot captured (${imageBuffer.byteLength} bytes)`)
    return imageBuffer
  } catch (error) {
    console.error(`❌ Microlink error:`, error)
    return null
  }
}

/**
 * Self-hosted Browserless: capture screenshot of video element if present
 * Improved selector strategy for Fathom video players
 */
async function captureWithBrowserlessAndUpload(url: string, recordingId: string): Promise<string | null> {
  const base = Deno.env.get('BROWSERLESS_URL') || 'https://chrome.browserless.io'
  const token = Deno.env.get('BROWSERLESS_TOKEN')
  if (!base || !token) return null

  try {
    // Try several selectors - prioritize the actual <video> tag
    const selectors = [
      'video',                          // Direct HTML5 video element (PRIMARY)
      'video-player video',             // Video inside custom element
      'section video',                  // Video inside section tag
      'div.relative video',             // Video in relative positioned div
      '[class*="video-"]',              // Any class with video- prefix
      'video-player',                   // Custom element (may capture whole page)
      'iframe[src*="fathom"]',         // Fathom embed iframe (fallback)
      'iframe',                         // Any iframe (last resort)
    ]

    for (const selector of selectors) {
      console.log(`🎯 Trying Browserless with selector: ${selector}`)
      const params = new URLSearchParams({
        token,
        url,
        format: 'jpeg',
        quality: '85',
        fullPage: 'false',
        blockAds: 'true',
        'viewport.width': '1920',
        'viewport.height': '1080',
        delay: '8000', // Extra time for Fathom to load and seek
        selector,
      })
      const endpoint = `${base.replace(/\/$/, '')}/screenshot?${params.toString()}`
      const resp = await fetch(endpoint)

      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        // Check for reasonable size (not a tiny placeholder or empty)
        if (buf.byteLength > 10000) { // At least 10KB for a real video frame
          console.log(`✅ Browserless succeeded with selector "${selector}" (${buf.byteLength} bytes)`)
          return await uploadToStorage(buf, recordingId)
        } else {
          console.log(`⚠️  Screenshot too small with "${selector}", trying next...`)
        }
      } else {
        console.log(`❌ Browserless failed with selector "${selector}": ${resp.status}`)
      }
    }

    // Last resort: capture viewport without selector (full page)
    console.log('🔄 Trying Browserless without selector (full viewport)...')
    const params = new URLSearchParams({
      token,
      url,
      format: 'jpeg',
      quality: '85',
      fullPage: 'false',
      blockAds: 'true',
      'viewport.width': '1920',
      'viewport.height': '1080',
      delay: '8000',
    })
    const endpoint = `${base.replace(/\/$/, '')}/screenshot?${params.toString()}`
    const resp = await fetch(endpoint)

    if (resp.ok) {
      const buf = await resp.arrayBuffer()
      if (buf.byteLength > 0) {
        console.log(`✅ Browserless full viewport captured (${buf.byteLength} bytes)`)
        return await uploadToStorage(buf, recordingId)
      }
    }

    return null
  } catch (e) {
    console.error('❌ Browserless error:', e)
    return null
  }
}

/**
 * Wrapper to capture via a provider and upload to S3
 */
async function captureViaProviderAndUpload(url: string, recordingId: string, provider: 'microlink' | 'screenshotone' | 'apiflash'): Promise<string | null> {
  let buf: ArrayBuffer | null = null
  if (provider === 'microlink') buf = await captureWithMicrolink(url)
  if (provider === 'screenshotone') buf = await captureWithScreenshotOne(url)
  if (provider === 'apiflash') buf = await captureWithApiFlash(url)
  if (!buf) return null
  return await uploadToStorage(buf, recordingId)
}

/**
 * Scrape og:image from a public share page (preferred)
 */
async function fetchThumbnailFromShareUrl(shareUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shareUrl, { headers: { 'User-Agent': 'Sixty/1.0 (+thumbnail-fetcher)', 'Accept': 'text/html' } })
    if (!res.ok) return null
    const html = await res.text()
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ]
    for (const p of patterns) {
      const m = html.match(p)
      if (m && m[1]) return m[1]
    }
    return null
  } catch {
    return null
  }
}

/**
 * Capture screenshot using ScreenshotOne (requires SCREENSHOTONE_API_KEY)
 */
async function captureWithScreenshotOne(embedUrl: string): Promise<ArrayBuffer | null> {
  try {
    const key = Deno.env.get('SCREENSHOTONE_API_KEY')
    if (!key) return null

    const params = new URLSearchParams({
      access_key: key,
      url: embedUrl,
      format: 'jpeg',
      jpeg_quality: '85',
      block_banners: 'true',
      viewport_width: '1920',
      viewport_height: '1080',
      delay: '7000', // wait for timestamp seek
      cache: 'false',
      selector: 'video', // Capture only the video element
    })

    const url = `https://api.screenshotone.com/take?${params.toString()}`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    return buf.byteLength > 0 ? buf : null
  } catch (e) {
    console.error('❌ ScreenshotOne error:', e)
    return null
  }
}

/**
 * Capture screenshot using APIFLASH (requires APIFLASH_API_KEY)
 */
async function captureWithApiFlash(embedUrl: string): Promise<ArrayBuffer | null> {
  try {
    const key = Deno.env.get('APIFLASH_API_KEY')
    if (!key) return null

    const params = new URLSearchParams({
      access_key: key,
      url: embedUrl,
      format: 'jpeg',
      quality: '85',
      width: '1920',
      height: '1080',
      response_type: 'binary',
      delay: '7', // seconds
      no_ads: 'true',
      fresh: 'true',
      element: 'video', // Capture only the video element
    })

    const url = `https://api.apiflash.com/v1/urltoimage?${params.toString()}`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    return buf.byteLength > 0 ? buf : null
  } catch (e) {
    console.error('❌ APIFLASH error:', e)
    return null
  }
}

/**
 * Upload image to AWS S3
 */
async function uploadToStorage(
  imageBuffer: ArrayBuffer,
  recordingId: string
): Promise<string | null> {
  try {
    const folder = (Deno.env.get('AWS_S3_FOLDER') || Deno.env.get('AWS_S3_THUMBNAILS_PREFIX') || 'meeting-thumbnails').replace(/\/+$/,'')
    const fileName = `${folder}/${recordingId}.jpg`

    // Get AWS credentials
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_REGION') || 'eu-west-2'
    const awsBucket = Deno.env.get('AWS_S3_BUCKET') || 'user-upload'

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
    }

    console.log(`📤 Uploading to AWS S3: ${awsBucket}/${fileName}`)

    const s3Client = new S3Client({
      endPoint: `s3.${awsRegion}.amazonaws.com`,
      region: awsRegion,
      accessKey: awsAccessKeyId,
      secretKey: awsSecretAccessKey,
      bucket: awsBucket,
      useSSL: true,
    })

    await s3Client.putObject(fileName, new Uint8Array(imageBuffer), {
      metadata: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })

    // Construct public URL
    const publicUrl = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${fileName}`
    console.log(`✅ Uploaded to S3: ${publicUrl}`)
    return publicUrl

  } catch (error) {
    console.error('Error uploading to S3:', error)
    return null
  }
}
