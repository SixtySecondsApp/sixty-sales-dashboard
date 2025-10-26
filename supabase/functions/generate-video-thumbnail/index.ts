import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recording_id, share_url, fathom_embed_url, timestamp_seconds }: ThumbnailRequest = await req.json()

    if (!recording_id || !fathom_embed_url) {
      throw new Error('Missing required fields: recording_id and fathom_embed_url')
    }

    console.log(`📸 Generating thumbnail for recording ${recording_id}...`)
    console.log(`📺 Embed URL: ${fathom_embed_url}`)

    // Capture screenshot and upload to storage (AWS S3 or Supabase)
    // Append timestamp param if provided to jump the embed to a specific time
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

    const thumbnailUrl = await captureVideoThumbnail(embedWithTs, recording_id)

    if (!thumbnailUrl) {
      throw new Error('Failed to capture video thumbnail')
    }

    console.log(`✅ Thumbnail generated: ${thumbnailUrl}`)

    return new Response(
      JSON.stringify({
        success: true,
        thumbnail_url: thumbnailUrl,
        recording_id,
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
  embedUrl: string,
  recordingId: string
): Promise<string | null> {
  try {
    console.log('📸 Capturing screenshot...')

    // Try Microlink API first (no key required)
    let imageBuffer: ArrayBuffer | null = await captureWithMicrolink(embedUrl)

    // Fallback 1: ScreenshotOne if API key configured
    if (!imageBuffer) {
      imageBuffer = await captureWithScreenshotOne(embedUrl)
    }

    // Fallback 2: APIFLASH if API key configured
    if (!imageBuffer) {
      imageBuffer = await captureWithApiFlash(embedUrl)
    }

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
 */
async function captureWithMicrolink(
  embedUrl: string
): Promise<ArrayBuffer | null> {
  try {
    const microlinkUrl = `https://api.microlink.io/?` + new URLSearchParams({
      url: embedUrl,
      screenshot: 'true',
      meta: 'false',
      'viewport.width': '1920',
      'viewport.height': '1080',
      'viewport.deviceScaleFactor': '1',
      // Give the player time to seek to the timestamp and render a frame
      waitFor: '7000',
    }).toString()

    console.log(`📡 Fetching screenshot from Microlink...`)

    const response = await fetch(microlinkUrl)

    if (!response.ok) {
      console.error(`Microlink API error: ${response.status}`)
      const errorText = await response.text()
      console.error(`Error details: ${errorText}`)
      return null
    }

    const data = await response.json()
    console.log(`Microlink response:`, JSON.stringify(data, null, 2))

    const screenshotUrl = data?.data?.screenshot?.url

    if (!screenshotUrl) {
      console.error('No screenshot URL in Microlink response')
      return null
    }

    // Download the screenshot
    console.log(`📥 Downloading screenshot from: ${screenshotUrl}`)
    const imageResponse = await fetch(screenshotUrl)

    if (!imageResponse.ok) {
      console.error(`Failed to download screenshot: ${imageResponse.status}`)
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    console.log(`✅ Screenshot downloaded successfully (${imageBuffer.byteLength} bytes)`)

    return imageBuffer
  } catch (error) {
    console.error(`❌ Microlink error:`, error)
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
