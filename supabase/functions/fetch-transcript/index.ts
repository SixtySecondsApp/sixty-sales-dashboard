import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FathomTranscriptResponse {
  transcript: string
}

async function fetchTranscriptFromFathom(
  accessToken: string,
  recordingId: string
): Promise<string | null> {
  try {
    console.log(`📄 Fetching transcript for recording ${recordingId}...`)

    const response = await fetch(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(`❌ Transcript fetch failed: HTTP ${response.status}`)
      if (response.status === 404) {
        console.log('ℹ️  Transcript not yet available (still processing)')
        return null
      }
      throw new Error(`Failed to fetch transcript: ${response.status}`)
    }

    const data: FathomTranscriptResponse = await response.json()
    console.log(`✅ Transcript fetched: ${data.transcript?.length || 0} characters`)

    return data.transcript || null
  } catch (error) {
    console.error(`❌ Error fetching transcript:`, error)
    throw error
  }
}

async function createGoogleDocForTranscript(
  supabase: any,
  userId: string,
  meetingId: string,
  title: string,
  plaintext: string
): Promise<string | null> {
  try {
    console.log(`📄 Creating Google Doc for transcript...`)

    // Get user's Google integration
    const { data: googleIntegration, error: googleError } = await supabase
      .from('integrations')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single()

    if (googleError || !googleIntegration) {
      console.log('ℹ️  No Google integration found, skipping Google Doc creation')
      return null
    }

    // Create Google Doc
    const docResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleIntegration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    })

    if (!docResponse.ok) {
      console.error(`❌ Google Doc creation failed: HTTP ${docResponse.status}`)
      return null
    }

    const doc = await docResponse.json()
    console.log(`✅ Google Doc created: ${doc.documentId}`)

    // Add transcript content to the doc
    await fetch(
      `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleIntegration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: plaintext,
              },
            },
          ],
        }),
      }
    )

    const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`
    console.log(`✅ Transcript added to Google Doc`)
    return docUrl
  } catch (error) {
    console.error(`❌ Error creating Google Doc:`, error)
    return null
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const userId = user.id

    // Get meeting ID from request
    const { meetingId } = await req.json()

    if (!meetingId) {
      throw new Error('Missing meetingId parameter')
    }

    console.log(`📋 Fetching transcript for meeting ${meetingId}`)

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, fathom_recording_id, title, transcript_text, transcript_doc_url, owner_user_id')
      .eq('id', meetingId)
      .eq('owner_user_id', userId)
      .single()

    if (meetingError || !meeting) {
      throw new Error('Meeting not found or access denied')
    }

    // Check if transcript already exists
    if (meeting.transcript_text) {
      console.log('ℹ️  Transcript already exists, returning cached version')
      return new Response(
        JSON.stringify({
          success: true,
          transcript: meeting.transcript_text,
          transcript_doc_url: meeting.transcript_doc_url,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Get Fathom integration
    const { data: fathomIntegration, error: integrationError } = await supabase
      .from('integrations')
      .select('access_token, fathom_user_id')
      .eq('user_id', userId)
      .eq('provider', 'fathom')
      .single()

    if (integrationError || !fathomIntegration) {
      throw new Error('Fathom integration not found')
    }

    // Fetch transcript from Fathom
    const transcriptText = await fetchTranscriptFromFathom(
      fathomIntegration.access_token,
      meeting.fathom_recording_id
    )

    if (!transcriptText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Transcript not yet available - still processing',
          processing: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202, // Accepted but not ready
        }
      )
    }

    // Create Google Doc if user has Google integration
    let transcriptDocUrl = meeting.transcript_doc_url
    if (!transcriptDocUrl) {
      transcriptDocUrl = await createGoogleDocForTranscript(
        supabase,
        userId,
        meeting.id,
        `Transcript • ${meeting.title || 'Meeting'}`,
        transcriptText
      )
    }

    // Update meeting with transcript
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript_text: transcriptText,
        transcript_doc_url: transcriptDocUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)

    if (updateError) {
      console.error('❌ Error updating meeting with transcript:', updateError)
      throw updateError
    }

    console.log(`✅ Transcript saved to meeting ${meetingId}`)

    return new Response(
      JSON.stringify({
        success: true,
        transcript: transcriptText,
        transcript_doc_url: transcriptDocUrl,
        cached: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Error in fetch-transcript function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
