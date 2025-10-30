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

    // Option 1: Try proxy approach first (if proxy edge function is deployed)
    const proxyUrl = shareUrlWithTs && Deno.env.get('ENABLE_PROXY_MODE') === 'true'
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/proxy-fathom-video?url=${encodeURIComponent(shareUrlWithTs)}&timestamp=${timestamp_seconds || 30}`
      : null

    // Option 2: Direct screenshot of Fathom page (skip iframe entirely)
    const directFathomUrl = shareUrlWithTs || shareWithTs

    // Option 3: Use React app page with embedded video
    // DISABLE APP MODE by default - it doesn't work with cross-origin iframes!
    const appUrl = meeting_id && shareUrlWithTs && !proxyUrl && Deno.env.get('ENABLE_APP_MODE') === 'true'
      ? `${Deno.env.get('APP_URL') || 'https://sales.sixtyseconds.video'}/meetings/thumbnail/${meeting_id}?shareUrl=${encodeURIComponent(shareUrlWithTs)}&t=${timestamp_seconds || 30}`
      : null

    console.log(`   Generated appUrl: ${appUrl}`)
    console.log(`   Direct Fathom URL: ${directFathomUrl}`)

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

    // Check if we should try proxy mode first
    if (!thumbnailUrl && proxyUrl && Deno.env.get('BROWSERLESS_URL')) {
      console.log('📸 Trying Browserless with PROXY MODE...')
      console.log(`   Proxy URL: ${proxyUrl}`)
      console.log(`   This proxies Fathom content without iframe restrictions`)
      thumbnailUrl = await captureWithBrowserlessAndUpload(proxyUrl, recording_id, 'fathom', meeting_id)

      if (thumbnailUrl) {
        console.log('✅ Proxy Mode succeeded!')
      } else {
        console.log('❌ Proxy Mode failed')
      }
    }

    // TRY DIRECT FATHOM SCREENSHOT FIRST (MOST RELIABLE)
    if (!thumbnailUrl && directFathomUrl && Deno.env.get('BROWSERLESS_URL')) {
      console.log('📸 Trying DIRECT Fathom screenshot (most reliable method)...')
      console.log(`   Direct Fathom URL: ${directFathomUrl}`)
      thumbnailUrl = await captureWithBrowserlessAndUpload(directFathomUrl, recording_id, 'fathom', meeting_id)

      if (thumbnailUrl) {
        console.log('✅ Direct Fathom screenshot succeeded!')
      } else {
        console.log('❌ Direct Fathom screenshot failed, will try other methods...')
      }
    }

    // App mode is disabled by default since cross-origin iframes don't work
    if (!thumbnailUrl && appUrl && Deno.env.get('ENABLE_APP_MODE') === 'true' && Deno.env.get('BROWSERLESS_URL')) {
      console.log('📸 APP MODE enabled - Trying embedded approach...')
      console.log(`   App URL: ${appUrl}`)
      console.log(`   Note: This usually fails due to X-Frame-Options`)
      thumbnailUrl = await captureWithBrowserlessAndUpload(appUrl, recording_id, 'app', meeting_id)

      if (thumbnailUrl) {
        console.log('✅ App mode screenshot succeeded!')
      } else {
        console.log('❌ App mode failed (expected due to iframe restrictions)')
      }
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

    // Skip duplicate fathom mode - we already tried direct Fathom screenshot above

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

    // Extract timestamp from URL if present
    const urlObj = new URL(url)
    const timestampFromUrl = urlObj.searchParams.get('timestamp') || urlObj.searchParams.get('t') || '30'
    const escapedTs = String(timestampFromUrl)

    // Use Playwright function API for full control
    const playwrightScript = mode === 'app'
      ? `
        // App mode: Screenshot our full-screen video page (with iframe security bypass)
        export default async function({ page, browser }) {
          console.log('🎬 Loading app page with enhanced iframe support...');
          console.log('📍 URL:', '${escapedUrl}');


          try {
            // Try with networkidle to ensure all resources load (60 second timeout!)
            await page.goto('${escapedUrl}', { waitUntil: 'networkidle', timeout: 60000 });
            console.log('✅ Page loaded with networkidle');
          } catch (e) {
            console.log('⚠️ NetworkIdle timeout, trying with domcontentloaded...');
            try {
              await page.goto('${escapedUrl}', { waitUntil: 'domcontentloaded', timeout: 60000 });
              console.log('✅ Page loaded with domcontentloaded');
            } catch (e2) {
              console.error('❌ Failed to load page:', e2.message);
              // Try one last time with just 'load'
              try {
                const response = await page.goto('${escapedUrl}', { waitUntil: 'load', timeout: 30000 });
                console.log('✅ Page loaded with "load" strategy');
                console.log('Response status:', response?.status());
              } catch (e3) {
                console.error('❌ All load strategies failed');
                console.error('This means Browserless cannot access your Vercel deployment');
                throw e3;
              }
            }
          }

          console.log('⏳ Waiting 15 seconds for iframe to fully load and video to seek...');
          await new Promise(resolve => setTimeout(resolve, 15000));

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

          // First check if React even loaded
          console.log('🔍 Checking if React loaded...');
          const reactLoaded = await page.evaluate(() => {
            return document.body.getAttribute('data-react-loaded') === 'true';
          });
          console.log(\`React loaded: \${reactLoaded}\`);

          if (!reactLoaded) {
            console.error('❌ React did not load - taking screenshot anyway for debugging');
            console.log('HTML preview:', await page.evaluate(() => document.body.innerHTML.substring(0, 500)));
          }

          console.log('⏳ Waiting for iframe to load (20 second timeout)...');
          const iframeSelector = 'iframe';
          try {
            await page.waitForSelector(iframeSelector, { timeout: 20000 });
            console.log('✅ Iframe element found');

            // Get iframe details
            const iframeInfo = await page.evaluate(() => {
              const iframe = document.querySelector('iframe');
              if (iframe) {
                return {
                  src: iframe.src,
                  width: iframe.width || iframe.offsetWidth,
                  height: iframe.height || iframe.offsetHeight,
                  display: window.getComputedStyle(iframe).display,
                  loaded: iframe.src ? true : false
                };
              }
              return null;
            });
            console.log('Iframe details:', JSON.stringify(iframeInfo));

            if (!iframeInfo || !iframeInfo.src) {
              console.error('⚠️ Iframe found but has no src!');
            }
          } catch (e) {
            console.error('❌ No iframe found after 20s');
            const html = await page.content();
            console.log('Page HTML length:', html.length);
            console.log('Page HTML preview:', html.substring(0, 1500));

            // Check what's actually on the page
            const bodyInfo = await page.evaluate(() => {
              return {
                hasBody: !!document.body,
                bodyClasses: document.body?.className || 'none',
                bodyText: document.body?.innerText?.substring(0, 200) || 'empty',
                rootElement: document.querySelector('#root') ? 'Found #root' : 'No #root',
                reactRoot: document.querySelector('[data-reactroot]') ? 'Found React root' : 'No React root',
                childCount: document.body?.children?.length || 0,
                hasError: document.body?.innerText?.includes('error') || document.body?.innerText?.includes('Error')
              };
            });
            console.log('Page structure:', JSON.stringify(bodyInfo));

            throw new Error('Iframe not found - MeetingThumbnail component may not have rendered');
          }

          console.log('⏳ Waiting 10 more seconds for video to fully load and seek...');
          await new Promise(resolve => setTimeout(resolve, 10000));

          console.log('📸 Taking screenshot...');
          return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
        }
      `
      : `
        // Fathom mode: Enhanced screenshot with improved video detection
        export default async function({ page, browser }) {
          console.log('🎬 Loading Fathom page directly...');
          console.log('📍 URL:', '${escapedUrl}');

          // Set viewport to standard video aspect ratio
          await page.setViewport({ width: 1920, height: 1080 });

          // Navigate with network idle to ensure all resources load
          try {
            await page.goto('${escapedUrl}', {
              waitUntil: 'networkidle',
              timeout: 30000
            });
            console.log('✅ Page loaded with networkidle');
          } catch (e) {
            console.log('⚠️ NetworkIdle timeout, continuing anyway...');
            await page.goto('${escapedUrl}', {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
          }

          console.log('⏳ Waiting for video player to fully initialize...');

          // Try multiple strategies to ensure video is ready
          let videoReady = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (!videoReady && attempts < maxAttempts) {
            attempts++;
            console.log(\`Attempt \${attempts}/\${maxAttempts} to find video...\`);

            // Wait a bit between attempts
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check for video element and its readiness
            const videoInfo = await page.evaluate(() => {
              const videos = document.querySelectorAll('video');
              if (videos.length === 0) return { found: false };

              // Get the first video that seems ready
              for (const video of videos) {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  return {
                    found: true,
                    ready: true,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    paused: video.paused,
                    src: video.src || video.currentSrc
                  };
                }
              }

              // Video found but not ready yet
              return {
                found: true,
                ready: false,
                count: videos.length
              };
            });

            console.log('Video info:', JSON.stringify(videoInfo));

            if (videoInfo.found && videoInfo.ready) {
              videoReady = true;
              console.log('✅ Video is ready!');

              // Try to seek to timestamp if needed
              const timestamp = ${escapedTs};
              if (timestamp > 0) {
                console.log(\`⏩ Seeking to timestamp: \${timestamp}s\`);
                await page.evaluate((ts) => {
                  const video = document.querySelector('video');
                  if (video) {
                    video.currentTime = ts;
                  }
                }, timestamp);

                // Wait for seek to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
              }

              break;
            }
          }

          if (!videoReady) {
            console.log('⚠️ Video not ready after all attempts, proceeding anyway...');
          }

          // Additional wait for any animations or overlays to settle
          await new Promise(resolve => setTimeout(resolve, 2000));

          console.log('📸 Taking screenshot...');

          // Enhanced video element targeting with fullscreen optimization
          const videoSelector = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && video.videoWidth > 0) {
              // Make video fullscreen by manipulating its styles
              video.style.position = 'fixed';
              video.style.top = '0';
              video.style.left = '0';
              video.style.width = '100vw';
              video.style.height = '100vh';
              video.style.objectFit = 'cover';
              video.style.zIndex = '999999';

              // Hide all other elements
              document.querySelectorAll('body > *:not(video)').forEach(el => {
                if (el !== video && !el.contains(video)) {
                  el.style.display = 'none';
                }
              });

              // Hide Fathom UI elements specifically
              const hideSelectors = [
                '.fathom-toolbar',
                '.fathom-controls',
                '[class*="toolbar"]',
                '[class*="controls"]',
                '[class*="overlay"]',
                'header',
                'nav',
                '.tabs',
                '[role="tablist"]'
              ];

              hideSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                  el.style.display = 'none';
                });
              });

              // Add a temporary ID for selection
              video.id = 'target-video-element';
              return '#target-video-element';
            }
            return null;
          });

          if (videoSelector) {
            console.log('📸 Attempting to screenshot full-screen video element...');

            // Wait for styles to apply
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
              // Take full viewport screenshot (video is now fullscreen)
              const screenshot = await page.screenshot({
                type: 'jpeg',
                quality: 90,
                fullPage: false
              });
              console.log('✅ Full-screen video screenshot captured!');
              return screenshot;
            } catch (e) {
              console.log('⚠️ Could not screenshot full-screen video:', e.message);
            }
          }

          // Fallback to full viewport screenshot
          console.log('📸 Taking full viewport screenshot...');
          return await page.screenshot({
            type: 'jpeg',
            quality: 90,
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
      console.log(`📊 Browserless response: ${buf.byteLength} bytes`)

      if (buf.byteLength > 10000) { // At least 10KB for a real video frame
        console.log(`✅ Browserless Playwright succeeded (${buf.byteLength} bytes)`)

        // Log success for App Mode
        if (mode === 'app') {
          console.log('🎉 App Mode SUCCESS! Screenshot captured from YOUR app')
        }

        return await uploadToStorage(buf, recordingId, meetingId)
      } else {
        console.log(`⚠️  Screenshot too small (${buf.byteLength} bytes) - likely blank page or error`)

        if (mode === 'app') {
          console.error('⚠️  App Mode returned small screenshot - page may not have loaded properly')
        }
      }
    } else {
      const errorText = await resp.text()
      console.error(`❌ Browserless HTTP error: ${resp.status}`)
      console.error(`❌ Error details: ${errorText.substring(0, 500)}`)

      if (mode === 'app') {
        console.error('❌ App Mode failed with HTTP error - check Browserless logs or connectivity')
      }
    }

    return null
  } catch (e) {
    console.error('❌ Browserless exception:', e.message)
    console.error('❌ Error type:', e.name)

    if (mode === 'app') {
      console.error('❌ App Mode threw exception - likely timeout or network error')
      console.error('   This usually means Browserless cannot reach your Vercel deployment')
      console.error('   Possible causes:')
      console.error('   1. Vercel is blocking Browserless IP address')
      console.error('   2. Browserless service is experiencing issues')
      console.error('   3. Network timeout (script takes >90 seconds)')
      console.error('   4. Your app has security middleware blocking headless browsers')
    }

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
