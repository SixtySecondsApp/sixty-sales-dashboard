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

    // Always screenshot the Fathom public share URL (preferred), fallback to embed URL
    const targetUrl = shareWithTs || embedWithTs

    let thumbnailUrl: string | null = null

    // Microlink multi-strategy capture (5s -> 3s -> viewport)
    console.log('📸 Attempting thumbnail capture with Microlink (multi-strategy)...')
    thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'microlink')

    if (!thumbnailUrl) {
      console.log('📸 Microlink failed, trying ScreenshotOne...')
      thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'screenshotone')
    }

    if (!thumbnailUrl) {
      console.log('📸 ScreenshotOne failed, trying ApiFlash...')
      thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'apiflash')
    }

    // Only try Browserless as last resort if configured and all else fails
    if (!thumbnailUrl && Deno.env.get('BROWSERLESS_URL')) {
      console.log('📸 All services failed, trying Browserless as last resort (fathom mode)...')
      thumbnailUrl = await captureWithBrowserlessAndUpload(targetUrl, recording_id, 'fathom')
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
 * For our full-screen video page, just capture the entire viewport
 * For Fathom pages, try video selectors
 */
async function captureWithMicrolink(
  url: string
): Promise<ArrayBuffer | null> {
  // Helper: promise race with timeout
  const raceWithTimeout = async <T>(promise: Promise<T>, ms: number, context: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${context}`)), ms)),
    ])
  }

  // Strategy for Fathom pages: Try to capture ONLY the <video> tag
  const videoSelectors = [
    'video',
    'video-player video',
    'section video',
    'div.relative video',
    '[class*="video-"]',
    'video-player',
  ]

  const trySelectors = async (waitMs: number): Promise<ArrayBuffer | null> => {
    for (const selector of videoSelectors) {
      try {
        const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
          url,
          screenshot: 'true',
          meta: 'false',
          'viewport.width': '1920',
          'viewport.height': '1080',
          'viewport.deviceScaleFactor': '2',
          waitFor: String(waitMs),
          'screenshot.element': selector,
          'screenshot.overlay.browser': 'false',
          'screenshot.overlay.background': 'transparent',
          'screenshot.scrollElement': 'false'
        }).toString()

        console.log(`📡 Microlink selector=${selector}, waitFor=${waitMs}ms`)

        const response = await fetch(microlinkUrl)
        if (!response.ok) {
          console.log(`Microlink failed for selector "${selector}": ${response.status}`)
          continue
        }

        const data = await response.json()
        const screenshotUrl = data?.data?.screenshot?.url
        if (!screenshotUrl) {
          console.log(`No screenshot URL for selector "${selector}"`)
          continue
        }

        const imageResponse = await fetch(screenshotUrl)
        if (!imageResponse.ok) {
          console.log(`Failed to download screenshot: ${imageResponse.status}`)
          continue
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        if (imageBuffer.byteLength > 10000) {
          console.log(`✅ Screenshot captured with selector "${selector}" (${imageBuffer.byteLength} bytes)`)
          return imageBuffer
        } else {
          console.log(`Screenshot too small with selector "${selector}", trying next...`)
        }
      } catch (error) {
        console.log(`Error with selector "${selector}":`, error)
        continue
      }
    }
    return null
  }

  // Strategy 1: selectors with 5s wait, 15s overall timeout
  try {
    const result = await raceWithTimeout(trySelectors(5000), 15000, 'microlink:selectors-5s')
    if (result) return result
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('timeout:')) {
      console.log('⏱️ Microlink 5s selector attempt timed out, trying 3s...')
    } else {
      console.log('Microlink 5s selector attempt failed:', e)
    }
  }

  // Strategy 2: selectors with 3s wait, 15s overall timeout
  try {
    const result = await raceWithTimeout(trySelectors(3000), 15000, 'microlink:selectors-3s')
    if (result) return result
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('timeout:')) {
      console.log('⏱️ Microlink 3s selector attempt timed out, falling back to viewport...')
    } else {
      console.log('Microlink 3s selector attempt failed:', e)
    }
  }

  // Strategy 3: viewport-only capture as final Microlink fallback
  try {
    console.log('📡 Microlink viewport-only fallback...')
    const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'false',
      'viewport.width': '1920',
      'viewport.height': '1080',
      'viewport.deviceScaleFactor': '1',
      waitFor: '2000',
      'screenshot.fullPage': 'false',
      'screenshot.overlay.browser': 'false',
      'screenshot.overlay.background': 'transparent',
    }).toString()

    const response = await raceWithTimeout(fetch(microlinkUrl), 15000, 'microlink:viewport')
    if (!response.ok) {
      console.error(`Microlink viewport screenshot failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    const screenshotUrl = data?.data?.screenshot?.url
    if (!screenshotUrl) {
      console.error('No screenshot URL in Microlink viewport response')
      return null
    }

    const imageResponse = await fetch(screenshotUrl)
    if (!imageResponse.ok) {
      console.error(`Failed to download viewport screenshot: ${imageResponse.status}`)
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    console.log(`✅ Viewport screenshot captured (${imageBuffer.byteLength} bytes)`)
    return imageBuffer
  } catch (error) {
    console.error(`❌ Microlink viewport error:`, error)
    return null
  }
}

/**
 * Self-hosted Browserless: capture screenshot using Playwright /function endpoint
 * This gives us full control over the browser and wait conditions
 * @param mode 'app' = screenshot our app's meeting page (targets iframe), 'fathom' = screenshot Fathom page directly
 */
async function captureWithBrowserlessAndUpload(url: string, recordingId: string, mode: 'app' | 'fathom' = 'fathom', meetingId?: string): Promise<string | null> {
  const base = Deno.env.get('BROWSERLESS_URL') || 'https://chrome.browserless.io'
  const token = Deno.env.get('BROWSERLESS_TOKEN')
  if (!base || !token) return null

  try {
    console.log(`🎯 Using Browserless Playwright function for ${mode} mode`)
    console.log(`📍 Target URL: ${url}`)

    // Use Playwright function API for full control
    const playwrightScript = mode === 'app'
      ? `
        // App mode: Wait for our full-screen video page to load
        // Since the video fills the entire viewport, screenshot the whole page
        export default async function({ page }) {
          await page.goto('${url}', { waitUntil: 'networkidle', timeout: 30000 });

          // Wait for page marker
          await page.waitForSelector('[data-thumbnail-ready="true"]', { timeout: 10000 });

          // Wait for iframe to load
          await page.waitForSelector('iframe[src*="fathom"], iframe[src*="embed"]', { timeout: 15000 });

          // Give video player time to initialize and load frame
          await page.waitForTimeout(5000);

          // Screenshot entire viewport (video fills it completely)
          return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
        }
      `
      : `
        // Fathom mode: Screenshot Fathom page directly
        export default async function({ page }) {
          await page.goto('${url}', { waitUntil: 'networkidle', timeout: 30000 });

          // Wait for video element
          const video = await page.waitForSelector('video', { timeout: 15000 });
          if (!video) throw new Error('Video element not found');

          // Give video player time to load frame
          await page.waitForTimeout(3000);

          // Screenshot just the video element
          return await video.screenshot({ type: 'jpeg', quality: 85 });
        }
      `

    const endpoint = `${base.replace(/\/$/, '')}/function?token=${token}`
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: playwrightScript,
    })

    if (resp.ok) {
      const buf = await resp.arrayBuffer()
      if (buf.byteLength > 10000) { // At least 10KB for a real video frame
        console.log(`✅ Browserless Playwright succeeded (${buf.byteLength} bytes)`)
        return await uploadToStorage(buf, recordingId, meetingId)
      } else {
        console.log(`⚠️  Screenshot too small (${buf.byteLength} bytes)`)
      }
    } else {
      const errorText = await resp.text()
      console.log(`❌ Browserless failed: ${resp.status} - ${errorText}`)
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
  recordingId: string,
  meetingId?: string
): Promise<string | null> {
  try {
    const folder = (Deno.env.get('AWS_S3_FOLDER') || Deno.env.get('AWS_S3_THUMBNAILS_PREFIX') || 'meeting-thumbnails').replace(/\/+$/,'')
    // Include meeting_id and timestamp to make each screenshot unique and avoid caching issues
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = meetingId
      ? `${folder}/${meetingId}_${timestamp}.jpg`
      : `${folder}/${recordingId}_${timestamp}.jpg`

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
