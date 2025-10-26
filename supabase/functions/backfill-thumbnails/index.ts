import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackfillProgress {
  total: number
  processed: number
  successful: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { batchSize = 10, dryRun = false } = await req.json().catch(() => ({}))

    console.log(`🚀 Starting thumbnail backfill...`)
    console.log(`📊 Batch size: ${batchSize}`)
    console.log(`🧪 Dry run: ${dryRun}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Query meetings without thumbnails
    const { data: meetings, error: queryError } = await supabase
      .from('meetings')
      .select('id, fathom_recording_id, share_url, title, duration_minutes')
      .is('thumbnail_url', null)
      .not('fathom_recording_id', 'is', null)
      .limit(batchSize)

    if (queryError) {
      throw new Error(`Failed to query meetings: ${queryError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No meetings require thumbnail generation',
          progress: {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            errors: []
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`📋 Found ${meetings.length} meetings without thumbnails`)

    const progress: BackfillProgress = {
      total: meetings.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    }

    // Helper: Build embed URL from share_url or recording_id
    function buildEmbedUrl(shareUrl?: string | null, recordingId?: string | null): string | null {
      try {
        if (recordingId) {
          return `https://app.fathom.video/recording/${recordingId}`
        }
        if (!shareUrl) return null
        const u = new URL(shareUrl)
        const parts = u.pathname.split('/').filter(Boolean)
        const token = parts.pop()
        if (!token) return null
        return `https://fathom.video/embed/${token}`
      } catch {
        return null
      }
    }

    // Helper: Try common direct thumbnail endpoints
    async function fetchFathomDirectThumbnail(recordingId: string | null, shareUrl?: string | null): Promise<string | null> {
      let shareId: string | null = null
      if (shareUrl) {
        try {
          const url = new URL(shareUrl)
          shareId = url.pathname.split('/').pop() || null
        } catch {}
      }
      const patterns = [
        recordingId ? `https://thumbnails.fathom.video/${recordingId}.jpg` : null,
        recordingId ? `https://thumbnails.fathom.video/${recordingId}.png` : null,
        recordingId ? `https://cdn.fathom.video/thumbnails/${recordingId}.jpg` : null,
        recordingId ? `https://cdn.fathom.video/thumbnails/${recordingId}.png` : null,
        recordingId ? `https://fathom.video/thumbnails/${recordingId}.jpg` : null,
        recordingId ? `https://app.fathom.video/thumbnails/${recordingId}.jpg` : null,
        shareId ? `https://thumbnails.fathom.video/${shareId}.jpg` : null,
        shareId ? `https://cdn.fathom.video/thumbnails/${shareId}.jpg` : null,
      ].filter(Boolean) as string[]

      for (const url of patterns) {
        try {
          const response = await fetch(url, { method: 'HEAD' })
          if (response.ok) return url
        } catch {}
      }
      return null
    }

    // Helper: Extract poster/thumbnail from embed HTML
    async function fetchThumbnailFromEmbed(shareUrl?: string | null, recordingId?: string | null): Promise<string | null> {
      const embedUrl = shareUrl
        ? (() => { try { const id = new URL(shareUrl).pathname.split('/').pop(); return id ? `https://fathom.video/embed/${id}` : null } catch { return null } })()
        : (recordingId ? `https://app.fathom.video/recording/${recordingId}` : null)
      if (!embedUrl) return null
      try {
        const response = await fetch(embedUrl, { headers: { 'User-Agent': 'Sixty/1.0 (+thumbnail-fetcher)', 'Accept': 'text/html' } })
        if (!response.ok) return null
        const html = await response.text()
        const patterns = [
          /poster=["']([^"']+)["']/i,
          /thumbnail["']?\s*:\s*["']([^"']+)["']/i,
          /posterImage["']?\s*:\s*["']([^"']+)["']/i,
          /previewImage["']?\s*:\s*["']([^"']+)["']/i,
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

    // Helper: Scrape og:image from share page
    async function fetchThumbnailFromShareUrl(shareUrl?: string | null): Promise<string | null> {
      if (!shareUrl) return null
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

    // Process each meeting
    for (const meeting of meetings) {
      try {
        console.log(`\n📸 Processing: ${meeting.title} (ID: ${meeting.id})`)

        const embedUrl = buildEmbedUrl(meeting.share_url, meeting.fathom_recording_id)
        if (!embedUrl) {
          console.warn('⚠️  Could not construct embed URL from share_url or recording id')
        }

        if (dryRun) {
          console.log(`🧪 [DRY RUN] Would generate thumbnail for: ${embedUrl}`)
          progress.processed++
          progress.successful++
          continue
        }

        // Cascade attempts
        let thumbnailUrl: string | null = null

        // 1) Try direct endpoints
        thumbnailUrl = await fetchFathomDirectThumbnail(meeting.fathom_recording_id, meeting.share_url)

        // 2) Try embed poster
        if (!thumbnailUrl) {
          thumbnailUrl = await fetchThumbnailFromEmbed(meeting.share_url, meeting.fathom_recording_id)
        }

        // 3) Try share page og:image
        if (!thumbnailUrl) {
          thumbnailUrl = await fetchThumbnailFromShareUrl(meeting.share_url)
        }

        // 4) Generate via thumbnail service
        if (!thumbnailUrl && embedUrl) {
          // Choose a representative timestamp: midpoint, clamped to >=5s
          const midpointSeconds = Math.max(5, Math.floor(((meeting as any).duration_minutes || 0) * 60 / 2))
          const thumbnailResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-video-thumbnail`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recording_id: meeting.fathom_recording_id,
                share_url: meeting.share_url,
                fathom_embed_url: embedUrl,
                timestamp_seconds: midpointSeconds,
              }),
            }
          )
          if (thumbnailResponse.ok) {
            const thumbnailData = await thumbnailResponse.json().catch(() => null)
            if (thumbnailData?.success && thumbnailData.thumbnail_url) {
              thumbnailUrl = thumbnailData.thumbnail_url
            }
          } else {
            const errText = await thumbnailResponse.text().catch(() => '')
            console.warn(`Thumbnail service error: ${thumbnailResponse.status} ${errText}`)
          }
        }

        // 5) Placeholder as last resort
        if (!thumbnailUrl) {
          const firstLetter = (meeting.title || 'M')[0].toUpperCase()
          thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
        }

        // Update meeting with thumbnail URL
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', meeting.id)

        if (updateError) {
          throw new Error(`Failed to update meeting: ${updateError.message}`)
        }

        console.log(`✅ Success: ${thumbnailUrl}`)
        progress.successful++

        // Rate limiting: wait 1 second between requests to avoid overwhelming Microlink free tier
        if (progress.processed < meetings.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`❌ Failed for meeting ${meeting.id}:`, error)
        progress.failed++
        progress.errors.push({
          id: meeting.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      progress.processed++
    }

    console.log(`\n📊 Backfill complete:`)
    console.log(`   Total: ${progress.total}`)
    console.log(`   Successful: ${progress.successful}`)
    console.log(`   Failed: ${progress.failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${progress.processed} meetings`,
        progress,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Backfill error:', error)
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
