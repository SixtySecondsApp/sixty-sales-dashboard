import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Simplified Video Thumbnail Generator - V2
 * 
 * Uses custom AWS Lambda API for screenshot generation + S3 upload
 * Much simpler than v1 (no Browserless, Microlink, etc.)
 * 
 * API: https://pnip1dhixe.execute-api.eu-west-2.amazonaws.com/fathom-thumbnail-generator/thumbnail
 */

interface ThumbnailRequest {
  recording_id: string
  share_url: string
  fathom_embed_url: string
  timestamp_seconds?: number
  meeting_id?: string
}

interface CustomAPIResponse {
  message: string
  thumbnail_size: number
  s3_location: string
  http_url: string
  fathom_url: string
  video_url: string
}

/**
 * Helper: Normalize Fathom share URL to working format
 */
function normalizeFathomShareUrl(shareUrl: string): string {
  try {
    const url = new URL(shareUrl)
    
    // If it's share.fathom.video (broken DNS), convert to app.fathom.video/share
    if (url.hostname === 'share.fathom.video') {
      const parts = url.pathname.split('/').filter(Boolean)
      const token = parts[parts.length - 1]
      return `https://app.fathom.video/share/${token}`
    }
    
    return shareUrl
  } catch {
    return shareUrl
  }
}

/**
 * Call custom thumbnail generation API
 */
async function captureWithCustomAPI(
  shareUrl: string,
  recordingId: string
): Promise<string | null> {
  try {
    const apiUrl = Deno.env.get('CUSTOM_THUMBNAIL_API_URL') || 
      'https://pnip1dhixe.execute-api.eu-west-2.amazonaws.com/fathom-thumbnail-generator/thumbnail'
    
    console.log(`📸 Calling custom thumbnail API...`)
    console.log(`   API URL: ${apiUrl}`)
    console.log(`   Share URL: ${shareUrl}`)
    console.log(`   Recording ID: ${recordingId}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fathom_url: shareUrl }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    
    console.log(`   Response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Custom API error: ${response.status}`)
      console.error(`   Error details: ${errorText.substring(0, 500)}`)
      return null
    }
    
    const data: CustomAPIResponse = await response.json()
    
    console.log(`   API Response:`)
    console.log(`     message: ${data.message}`)
    console.log(`     thumbnail_size: ${data.thumbnail_size} bytes`)
    console.log(`     s3_location: ${data.s3_location}`)
    console.log(`     http_url: ${data.http_url}`)
    
    if (data.http_url) {
      console.log(`✅ Thumbnail generated successfully via custom API`)
      console.log(`   Final URL: ${data.http_url}`)
      return data.http_url
    }
    
    console.error('❌ Custom API returned no http_url')
    return null
  } catch (error) {
    console.error('❌ Custom API exception:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace: ${error.stack.substring(0, 300)}`)
    }
    return null
  }
}

/**
 * Fallback: Scrape og:image from Fathom share page
 */
async function fetchThumbnailFromShareUrl(shareUrl: string): Promise<string | null> {
  try {
    console.log(`📄 Attempting og:image scraping from share page...`)
    console.log(`   URL: ${shareUrl}`)
    
    const res = await fetch(shareUrl, {
      headers: {
        'User-Agent': 'Sixty/1.0 (+thumbnail-fetcher)',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!res.ok) {
      console.log(`❌ Share page fetch failed: ${res.status}`)
      return null
    }
    
    const html = await res.text()
    
    // Try multiple og:image patterns
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        console.log(`✅ Found og:image: ${match[1]}`)
        return match[1]
      }
    }
    
    console.log(`❌ No og:image meta tag found`)
    return null
  } catch (error) {
    console.error(`❌ og:image scraping failed:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  console.log(`🚀 Thumbnail Generator V2 - Function invoked: ${req.method}`)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const { recording_id, share_url, fathom_embed_url, timestamp_seconds, meeting_id }: ThumbnailRequest = await req.json()

    console.log(`   recording_id: ${recording_id}`)
    console.log(`   share_url: ${share_url}`)
    console.log(`   fathom_embed_url: ${fathom_embed_url}`)
    console.log(`   timestamp_seconds: ${timestamp_seconds}`)
    console.log(`   meeting_id: ${meeting_id}`)

    if (!recording_id || !share_url) {
      console.error('❌ Missing required fields')
      throw new Error('Missing required fields: recording_id and share_url')
    }

    console.log(`📸 Generating thumbnail for recording ${recording_id}...`)

    // Normalize share URL
    const normalizedShareUrl = normalizeFathomShareUrl(share_url)
    console.log(`📍 Normalized share URL: ${normalizedShareUrl}`)

    let thumbnailUrl: string | null = null

    // Try custom API first (primary method)
    if (Deno.env.get('ENABLE_VIDEO_THUMBNAILS') === 'true') {
      console.log('🎯 Trying custom thumbnail API...')
      thumbnailUrl = await captureWithCustomAPI(normalizedShareUrl, recording_id)
    } else {
      console.log('⏭️  Thumbnail generation disabled (ENABLE_VIDEO_THUMBNAILS != true)')
    }

    // Fallback to og:image scraping
    if (!thumbnailUrl) {
      console.log('🔄 Custom API failed, trying og:image scraping...')
      thumbnailUrl = await fetchThumbnailFromShareUrl(normalizedShareUrl)
    }

    // Final fallback: placeholder image
    if (!thumbnailUrl) {
      console.log('⚠️  All methods failed, using placeholder')
      const firstLetter = (share_url.match(/\/([A-Za-z])/)?.[1] || 'M').toUpperCase()
      thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
    }

    console.log(`✅ Final thumbnail URL: ${thumbnailUrl}`)

    // If meeting_id provided, persist to database using service role
    let dbUpdated = false
    if (meeting_id && thumbnailUrl) {
      try {
        console.log(`💾 Updating database for meeting ${meeting_id}...`)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', meeting_id)
        
        if (!updateError) {
          dbUpdated = true
          console.log(`✅ Database updated successfully`)
        } else {
          console.error(`❌ Database update failed:`, updateError)
        }
      } catch (e) {
        console.warn('⚠️  Failed to persist thumbnail_url:', e instanceof Error ? e.message : String(e))
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        thumbnail_url: thumbnailUrl,
        recording_id,
        db_updated: dbUpdated,
        method_used: thumbnailUrl.includes('fathom-thumbnail.s3') ? 'custom_api' : 
                     thumbnailUrl.includes('placeholder') ? 'placeholder' : 'og_image'
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

