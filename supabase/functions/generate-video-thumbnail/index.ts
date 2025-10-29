import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Helper: Normalize Fathom share URL to working format
 * Converts share.fathom.video/* to app.fathom.video/share/*
 * which is the actual working public share URL format
 */
function normalizeFathomShareUrl(shareUrl: string): string {
  try {
    const url = new URL(shareUrl);

    // If it's share.fathom.video (broken DNS), convert to app.fathom.video/share
    if (url.hostname === 'share.fathom.video') {
      const parts = url.pathname.split('/').filter(Boolean);
      const token = parts[parts.length - 1];
      return `https://app.fathom.video/share/${token}`;
    }

    // Already in correct format or unknown format - return as-is
    return shareUrl;
  } catch {
    return shareUrl;
  }
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
    // IMPORTANT: Normalize share.fathom.video to app.fathom.video/share (working DNS)
    const normalizedShareUrl = share_url ? normalizeFathomShareUrl(share_url) : null
    const shareWithTs = normalizedShareUrl
      ? (() => { try {
            const u = new URL(normalizedShareUrl)
            if (typeof timestamp_seconds === 'number' && timestamp_seconds > 0) {
              u.searchParams.set('timestamp', String(Math.floor(timestamp_seconds)))
            }
            return u.toString()
          } catch { return normalizedShareUrl } })()
      : null

    console.log(`📍 URL Normalization:`)
    console.log(`   Original share_url: ${share_url}`)
    console.log(`   Normalized: ${normalizedShareUrl}`)
    console.log(`   With timestamp: ${shareWithTs}`)

    // Always screenshot the Fathom public share URL (preferred), fallback to embed URL
    const targetUrl = shareWithTs || embedWithTs

    // Build our app's MeetingThumbnail page URL as preferred target for Browserless
    // This avoids iframe CORS issues by showcasing video full-screen in our app
    // IMPORTANT: FathomPlayerV2 component can work with either:
    // 1. shareUrl (public share link) - best option, no auth required
    // 2. recordingId (falls back to app.fathom.video/recording/{id}) - requires auth
    // We should prefer actual share URLs when available

    // For the MeetingThumbnail page, we need to pass EITHER:
    // - A valid share URL that FathomPlayerV2 can extract an ID from
    // - OR a recordingId directly

    // CRITICAL FIX: Use the PUBLIC share_url, not fathom_embed_url!
    // - share_url (https://fathom.video/share/...) = PUBLIC, no auth needed ✅
    // - fathom_embed_url (https://app.fathom.video/recording/...) = REQUIRES AUTH ❌
    //
    // For MeetingThumbnail page, pass the share_url with timestamp
    const shareUrlWithTs = share_url ? `${share_url}${share_url.includes('?') ? '&' : '?'}timestamp=${timestamp_seconds || 30}` : null

    console.log(`🔗 Building App URL:`)
    console.log(`   share_url (original): ${share_url}`)
    console.log(`   shareUrlWithTs: ${shareUrlWithTs}`)
    console.log(`   fathom_embed_url: ${fathom_embed_url}`)
    console.log(`   recording_id: ${recording_id}`)
    console.log(`   timestamp_seconds: ${timestamp_seconds}`)

    const appUrl = meeting_id && shareUrlWithTs
      ? `${Deno.env.get('APP_URL') || 'https://sales.sixtyseconds.video'}/meetings/thumbnail/${meeting_id}?shareUrl=${encodeURIComponent(shareUrlWithTs)}&t=${timestamp_seconds || 30}`
      : null

    console.log(`   Generated appUrl: ${appUrl}`)

    let thumbnailUrl: string | null = null

    // Check if we should skip third-party services and force app mode
    const onlyBrowserlessValue = Deno.env.get('ONLY_BROWSERLESS')
    const disableThirdPartyValue = Deno.env.get('DISABLE_THIRD_PARTY_SCREENSHOTS')
    const forceAppModeValue = Deno.env.get('FORCE_APP_MODE')
    const onlyBrowserless = onlyBrowserlessValue === 'true'
    const disableThirdParty = disableThirdPartyValue === 'true'
    const forceAppMode = forceAppModeValue === 'true'
    const skipThirdParty = onlyBrowserless || disableThirdParty || forceAppMode

    console.log(`🔧 Environment check:`)
    console.log(`   ONLY_BROWSERLESS="${onlyBrowserlessValue}" (skip=${onlyBrowserless})`)
    console.log(`   DISABLE_THIRD_PARTY="${disableThirdPartyValue}" (skip=${disableThirdParty})`)
    console.log(`   FORCE_APP_MODE="${forceAppModeValue}" (force=${forceAppMode})`)
    console.log(`   skipThirdParty=${skipThirdParty}`)

    // Prefer Browserless app mode first when meeting_id present (gives clean, cropped video)
    if (!thumbnailUrl && appUrl && Deno.env.get('BROWSERLESS_URL')) {
      console.log('📸 Trying Browserless with APP MODE (our own page)...')
      console.log(`   App URL: ${appUrl}`)
      console.log(`   This will screenshot OUR application's public thumbnail page`)
      console.log(`   Expected: Full-screen video iframe, cropped to video only`)
      thumbnailUrl = await captureWithBrowserlessAndUpload(appUrl, recording_id, 'app', meeting_id)

      if (!thumbnailUrl) {
        console.error('❌ App Mode failed - check if the app is accessible from Browserless')
        console.error(`   URL that failed: ${appUrl}`)
        console.error(`   Possible issues:`)
        console.error(`     1. MeetingThumbnail page not loading (404 or redirect)`)
        console.error(`     2. Iframe selector 'iframe[src*="fathom"]' timeout`)
        console.error(`     3. Network connectivity between Browserless and your app`)
        console.error(`     4. Share URL is invalid or requires auth`)

        if (forceAppMode) {
          console.error(`   🚨 FORCE_APP_MODE is enabled - will NOT fallback to other methods`)
          console.error(`   Fix the App Mode issue or disable FORCE_APP_MODE to allow fallbacks`)
        }
      } else {
        console.log('✅ App Mode succeeded!')
        console.log(`   Screenshot captured from: ${appUrl}`)
      }
    } else if (!appUrl) {
      console.log('⏭️  Skipping App Mode (no appUrl generated - missing meeting_id or share_url)')
    }

    if (!thumbnailUrl && !skipThirdParty) {
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

    // Try Browserless fathom mode if still not available
    // BUT: Skip if FORCE_APP_MODE is set (we want ONLY our app to be screenshotted)
    if (!thumbnailUrl && Deno.env.get('BROWSERLESS_URL') && !forceAppMode) {
      console.log('📸 Trying Browserless fathom mode as fallback...')
      // Try share URL first (public access, no login required)
      if (shareWithTs) {
        console.log(`   Trying public share URL: ${shareWithTs}`)
        thumbnailUrl = await captureWithBrowserlessAndUpload(shareWithTs, recording_id, 'fathom', meeting_id)
      }
      // Fallback to embed URL if share fails
      if (!thumbnailUrl && embedWithTs) {
        console.log(`   Share URL failed, trying embed URL: ${embedWithTs}`)
        thumbnailUrl = await captureWithBrowserlessAndUpload(embedWithTs, recording_id, 'fathom', meeting_id)
      }
    } else if (forceAppMode && !thumbnailUrl) {
      console.log('🚫 Skipping Browserless Fathom mode fallback (FORCE_APP_MODE is enabled)')
      console.log('   App Mode must succeed for thumbnail generation')
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
          console.log('🎬 Loading app page...');
          console.log('📍 URL:', '${escapedUrl}');

          // Set a more standard user agent to avoid detection as headless browser
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

          // Set viewport to standard desktop size
          await page.setViewportSize({ width: 1920, height: 1080 });

          try {
            // Try with networkidle to ensure all resources load
            await page.goto('${escapedUrl}', { waitUntil: 'networkidle', timeout: 30000 });
            console.log('✅ Page loaded with networkidle');
          } catch (e) {
            console.log('⚠️ NetworkIdle timeout, trying with domcontentloaded...');
            try {
              await page.goto('${escapedUrl}', { waitUntil: 'domcontentloaded', timeout: 30000 });
              console.log('✅ Page loaded with domcontentloaded');
            } catch (e2) {
              console.error('❌ Failed to load page:', e2.message);
              // Log the response status if available
              const response = await page.goto('${escapedUrl}', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null);
              if (response) {
                console.log('Response status:', response.status());
                console.log('Response headers:', JSON.stringify(response.headers()));
              }
              throw e2;
            }
          }

          console.log('⏳ Waiting 3 seconds for React to render...');
          await new Promise(resolve => setTimeout(resolve, 3000));

          console.log('🔍 Checking page content...');
          const title = await page.title();
          const url = page.url();
          console.log('  Page title:', title);
          console.log('  Current URL:', url);

          // Check if we got redirected
          if (!url.includes('/meetings/thumbnail/')) {
            console.error('⚠️ Page was redirected! Expected /meetings/thumbnail/, got:', url);
          }

          // Check for error messages
          const errorText = await page.evaluate(() => {
            const body = document.body;
            if (!body) return null;
            const text = body.innerText || body.textContent;
            if (text && (text.includes('error') || text.includes('Error') || text.includes('404') || text.includes('403'))) {
              return text.substring(0, 500);
            }
            return null;
          });

          if (errorText) {
            console.log('⚠️ Possible error on page:', errorText);
          }

          console.log('⏳ Waiting for iframe to load...');
          const iframeSelector = 'iframe';
          try {
            await page.waitForSelector(iframeSelector, { timeout: 15000 });
            console.log('✅ Iframe element found');

            // Get iframe details
            const iframeInfo = await page.evaluate(() => {
              const iframe = document.querySelector('iframe');
              if (iframe) {
                return {
                  src: iframe.src,
                  width: iframe.width,
                  height: iframe.height,
                  display: window.getComputedStyle(iframe).display
                };
              }
              return null;
            });
            console.log('Iframe info:', JSON.stringify(iframeInfo));
          } catch (e) {
            console.log('⚠️  No iframe found after 15s');
            const html = await page.content();
            console.log('Page HTML length:', html.length);
            console.log('Page HTML preview:', html.substring(0, 1000));

            // Check what's actually on the page
            const bodyInfo = await page.evaluate(() => {
              return {
                hasBody: !!document.body,
                bodyClasses: document.body?.className,
                rootElement: document.querySelector('#root') ? 'Found #root' : 'No #root',
                reactRoot: document.querySelector('[data-reactroot]') ? 'Found React root' : 'No React root',
                childCount: document.body?.children?.length || 0
              };
            });
            console.log('Page structure:', JSON.stringify(bodyInfo));

            throw new Error('Iframe not found on page - check if MeetingThumbnail component rendered');
          }

          console.log('⏳ Waiting 8 more seconds for video to fully load...');
          await new Promise(resolve => setTimeout(resolve, 8000));

          console.log('📸 Taking screenshot...');
          return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
        }
      `
      : `
        // Fathom mode: Simple screenshot of Fathom page
        export default async function({ page }) {
          console.log('🎬 Loading Fathom page...');
          await page.goto('${escapedUrl}', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });

          console.log('⏳ Waiting for video player to initialize...');
          // Extended wait for video player to fully load
          // This allows time for:
          // 1. Page scripts to load (2s)
          // 2. Video player to initialize (2s)
          // 3. Video to seek to timestamp (2s)
          // 4. First frame to render (2s)
          await new Promise(resolve => setTimeout(resolve, 8000));

          console.log('✅ Checking for video element...');
          // Try to find and verify video element is present
          const hasVideo = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (!video) return false;
            // Check if video has actual dimensions
            return video.videoWidth > 0 && video.videoHeight > 0;
          });

          if (!hasVideo) {
            console.log('⚠️  Video element not ready, waiting additional 3s...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            console.log('✅ Video element found and ready');
          }

          console.log('📸 Taking screenshot...');
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
