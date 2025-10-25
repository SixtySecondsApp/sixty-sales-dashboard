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
      .select('id, fathom_recording_id, share_url, title')
      .is('thumbnail_url', null)
      .not('fathom_recording_id', 'is', null)
      .not('share_url', 'is', null)
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

    // Process each meeting
    for (const meeting of meetings) {
      try {
        console.log(`\n📸 Processing: ${meeting.title} (ID: ${meeting.id})`)

        // Construct embed URL
        const shareUrlMatch = meeting.share_url.match(/\/share\/([^/]+)/)
        if (!shareUrlMatch) {
          throw new Error('Could not extract share ID from share_url')
        }
        const shareId = shareUrlMatch[1]
        const embedUrl = `https://fathom.video/embed/${shareId}`

        if (dryRun) {
          console.log(`🧪 [DRY RUN] Would generate thumbnail for: ${embedUrl}`)
          progress.processed++
          progress.successful++
          continue
        }

        // Call thumbnail generation function
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
            }),
          }
        )

        const thumbnailData = await thumbnailResponse.json()

        if (!thumbnailData.success || !thumbnailData.thumbnail_url) {
          throw new Error(thumbnailData.error || 'Failed to generate thumbnail')
        }

        // Update meeting with thumbnail URL
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailData.thumbnail_url })
          .eq('id', meeting.id)

        if (updateError) {
          throw new Error(`Failed to update meeting: ${updateError.message}`)
        }

        console.log(`✅ Success: ${thumbnailData.thumbnail_url}`)
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
