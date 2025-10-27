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
  console.log(`🚀 Function invoked: ${req.method}`)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const { recording_id, share_url, fathom_embed_url, timestamp_seconds, meeting_id }: ThumbnailRequest = await req.json()

    console.log(`   recording_id: ${recording_id}`)
    console.log(`   share_url: ${share_url}`)
    console.log(`   fathom_embed_url: ${fathom_embed_url}`)

    if (!recording_id || !fathom_embed_url) {
      console.error('❌ Missing required fields')
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

    // Build our app's MeetingThumbnail page URL as preferred target for Browserless
    // This avoids iframe CORS issues by showcasing video full-screen in our app
    const appUrl = meeting_id
      ? `${Deno.env.get('APP_URL') || 'https://app.sixtyseconds.video'}/meetings/thumbnail/${meeting_id}?shareUrl=${encodeURIComponent(share_url || '')}&recordingId=${recording_id}&t=${timestamp_seconds || 30}`
      : null

    let thumbnailUrl: string | null = null

    // Check if we should skip third-party services
    const onlyBrowserlessValue = Deno.env.get('ONLY_BROWSERLESS')
    const disableThirdPartyValue = Deno.env.get('DISABLE_THIRD_PARTY_SCREENSHOTS')
    const onlyBrowserless = onlyBrowserlessValue === 'true'
    const disableThirdParty = disableThirdPartyValue === 'true'
    const skipThirdParty = onlyBrowserless || disableThirdParty

    console.log(`🔧 Environment check:`)
    console.log(`   ONLY_BROWSERLESS="${onlyBrowserlessValue}" (skip=${onlyBrowserless})`)
    console.log(`   DISABLE_THIRD_PARTY="${disableThirdPartyValue}" (skip=${disableThirdParty})`)
    console.log(`   skipThirdParty=${skipThirdParty}`)

    if (!skipThirdParty) {
      // Try third-party services first
      // Microlink multi-strategy capture (5s -> 3s -> viewport)
      console.log('📸 Attempting thumbnail capture with Microlink (multi-strategy)...')
      console.log(`   URL: ${targetUrl}`)
      thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'microlink')
      
      if (thumbnailUrl) {
        console.log('✅ Microlink succeeded!')
      } else {
        console.log('❌ Microlink failed, trying ScreenshotOne...')
        thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'screenshotone')
        
        if (thumbnailUrl) {
          console.log('✅ ScreenshotOne succeeded!')
        }
      }

      if (!thumbnailUrl) {
        console.log('❌ ScreenshotOne failed, trying ApiFlash...')
        thumbnailUrl = await captureViaProviderAndUpload(targetUrl, recording_id, 'apiflash')
        
        if (thumbnailUrl) {
          console.log('✅ ApiFlash succeeded!')
        }
      }
    } else {
      console.log('📸 Skipping third-party services (ONLY_BROWSERLESS or DISABLE_THIRD_PARTY_SCREENSHOTS set)')
    }

    // Try Browserless if configured and (third-party failed or skipped)
    if (!thumbnailUrl && Deno.env.get('BROWSERLESS_URL')) {
      // Prefer app mode (our MeetingThumbnail page) over fathom mode to avoid iframe CORS
      if (appUrl) {
        console.log('📸 Trying Browserless with app mode (preferred)...')
        thumbnailUrl = await captureWithBrowserlessAndUpload(appUrl, recording_id, 'app', meeting_id)
      }
      
      // Fallback to fathom mode if app mode failed or unavailable
      if (!thumbnailUrl) {
        console.log('📸 App mode failed or unavailable, trying Browserless fathom mode...')
        thumbnailUrl = await captureWithBrowserlessAndUpload(targetUrl, recording_id, 'fathom', meeting_id)
      }
    }

    // E) Last resort: og:image (often unavailable per user)
    if (!thumbnailUrl && shareWithTs) {
      thumbnailUrl = await fetchThumbnailFromShareUrl(shareWithTs)
    }

    if (!thumbnailUrl) {
      console.error('❌ All thumbnail capture methods failed')
      console.error(`Config: skipThirdParty=${skipThirdParty}, browserlessConfigured=${!!Deno.env.get('BROWSERLESS_URL')}`)
      throw new Error('Failed to capture video thumbnail - all methods exhausted')
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
  try {
    console.log('📡 Microlink: Simple viewport screenshot')
    console.log(`   Target URL: ${url}`)
    
    // Use the simplest, fastest approach - just screenshot the viewport
    const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'false',
      'viewport.width': '1280',
      'viewport.height': '720',
      waitFor: '1000',
      'screenshot.fullPage': 'false',
      'screenshot.overlay.browser': 'false',
    }).toString()

    console.log(`   Microlink API URL: ${microlinkUrl.substring(0, 100)}...`)
    console.log(`   Fetching screenshot...`)
    
    const response = await fetch(microlinkUrl, {
      signal: AbortSignal.timeout(20000),
    })
    
    console.log(`   Response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error')
      console.log(`❌ Microlink API failed: ${response.status}`)
      console.log(`   Error: ${errorText.substring(0, 200)}`)
      return null
    }

    const data = await response.json()
    console.log(`   Response status field: ${data?.status}`)
    
    const screenshotUrl = data?.data?.screenshot?.url
    
    if (!screenshotUrl) {
      console.log('❌ No screenshot URL in response')
      console.log(`   Response data: ${JSON.stringify(data).substring(0, 200)}`)
      return null
    }

    console.log(`   Screenshot URL: ${screenshotUrl}`)
    console.log(`   Downloading image...`)
    
    const imageResponse = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(10000),
    })
    
    console.log(`   Image download status: ${imageResponse.status}`)
    
    if (!imageResponse.ok) {
      console.log(`❌ Failed to download screenshot`)
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    console.log(`   Downloaded: ${imageBuffer.byteLength} bytes`)
    
    if (imageBuffer.byteLength < 5000) {
      console.log(`❌ Screenshot too small`)
      return null
    }
    
    console.log(`✅ Microlink screenshot captured successfully`)
    return imageBuffer
    
  } catch (error) {
    console.error(`❌ Microlink exception:`, error)
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`)
      console.error(`   Error stack: ${error.stack?.substring(0, 300)}`)
    }
    return null
  }
}

/**
 * Self-hosted Browserless: capture screenshot using Playwright /function endpoint
 * This gives us full control over the browser and wait conditions
 * @param mode 'app' = screenshot our app's meeting page (targets iframe), 'fathom' = screenshot Fathom page directly
 */
async function captureWithBrowserlessAndUpload(url: string, recordingId: string, mode: 'app' | 'fathom' = 'fathom', meetingId?: string): Promise<string | null> {
  const base = Deno.env.get('BROWSERLESS_URL') || 'https://production-sfo.browserless.io'
  const token = Deno.env.get('BROWSERLESS_TOKEN')
  if (!base || !token) return null

  try {
    console.log(`🎯 Using Browserless Playwright function for ${mode} mode`)
    console.log(`📍 Target URL: ${url}`)

    // Escape URL for safe injection into JavaScript
    const escapedUrl = url.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")

    // Use Playwright function API for full control
    const playwrightScript = mode === 'app'
      ? `
        // App mode: Screenshot our full-screen video page
        export default async function({ page }) {
          await page.goto('${escapedUrl}', { waitUntil: 'networkidle2', timeout: 45000 });
          
          // Wait for page marker
          await page.waitForSelector('[data-thumbnail-ready="true"]', { timeout: 10000 });
          
          // Wait a bit for video to render (using alternative to waitForTimeout)
          await page.waitForLoadState('networkidle');
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Screenshot entire viewport
          return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
        }
      `
      : `
        // Fathom mode: Simple screenshot of Fathom page
        export default async function({ page }) {
          await page.goto('${escapedUrl}', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
          });

          // Wait for page to settle (alternative to waitForTimeout)
          await page.waitForLoadState('networkidle');
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Take viewport screenshot
          return await page.screenshot({ 
            type: 'jpeg', 
            quality: 85, 
            fullPage: false 
          });
        }
      `

    const endpoint = `${base.replace(/\/$/, '')}/function?token=${token}`
    
    // Add timeout wrapper around fetch to prevent hanging
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
    
    const resp = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: playwrightScript,
    }, 90000) // 90 second timeout (Fathom pages are slow)

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
    console.log(`📤 Starting S3 upload for recording ${recordingId}...`)
    console.log(`   Buffer size: ${imageBuffer.byteLength} bytes`)
    
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
      console.error('❌ AWS credentials missing!')
      throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
    }

    console.log(`📤 Uploading to AWS S3: ${awsBucket}/${fileName}`)
    console.log(`   Region: ${awsRegion}`)

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
