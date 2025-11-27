/**
 * Meeting Intelligence Process Queue Edge Function
 *
 * Background job processor for indexing meetings to Google File Search.
 * Processes items from the meeting_index_queue table with retry logic.
 *
 * Can be triggered by:
 * - Cron job (pg_cron or external)
 * - Manual invocation
 * - Webhook from other functions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const BATCH_SIZE = 10
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 5000 // 5 seconds

interface QueueItem {
  id: string
  meeting_id: string
  user_id: string
  priority: number
  attempts: number
  max_attempts: number
  last_attempt_at: string | null
  created_at: string
}

interface ProcessResult {
  success: boolean
  meeting_id: string
  message: string
}

interface MeetingDocument {
  meeting_id: string
  title: string
  date: string
  company_name: string | null
  company_id: string | null
  contact_name: string | null
  contact_id: string | null
  attendees: string[]
  duration_minutes: number | null
  sentiment_score: number | null
  sentiment_label: string
  sentiment_reasoning: string | null
  transcript: string
  summary: string | null
  action_items: string[]
  talk_time_rep_pct: number | null
  talk_time_customer_pct: number | null
}

/**
 * Check if enough time has passed for retry (exponential backoff)
 */
function shouldRetry(item: QueueItem): boolean {
  if (item.attempts >= item.max_attempts) return false
  if (!item.last_attempt_at) return true

  const lastAttempt = new Date(item.last_attempt_at).getTime()
  const backoffMs = BACKOFF_BASE_MS * Math.pow(2, item.attempts)
  const now = Date.now()

  return now - lastAttempt >= backoffMs
}

/**
 * Get or create File Search store for a user
 */
async function getOrCreateStore(
  userId: string,
  supabase: any,
  geminiApiKey: string
): Promise<string> {
  // Check existing store
  const { data: existingStore } = await supabase
    .from('user_file_search_stores')
    .select('store_name')
    .eq('user_id', userId)
    .single()

  if (existingStore?.store_name) {
    return existingStore.store_name
  }

  // Create new store
  const displayName = `meetings-${userId.substring(0, 8)}-${Date.now()}`

  const response = await fetch(
    `${GEMINI_API_BASE}/fileSearchStores?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`File Search store creation failed - Status: ${response.status}, Body: ${errorText}`)
    throw new Error(`Failed to create File Search store (${response.status}): ${errorText || 'No error details'}`)
  }

  const storeData = await response.json()
  const storeName = storeData.name

  // Save to database
  await supabase
    .from('user_file_search_stores')
    .insert({
      user_id: userId,
      store_name: storeName,
      display_name: displayName,
      status: 'active'
    })

  return storeName
}

/**
 * Build meeting document from database record
 */
function buildMeetingDocument(meeting: any): MeetingDocument {
  const attendees: string[] = []
  if (meeting.meeting_attendees) {
    meeting.meeting_attendees.forEach((a: any) => {
      if (a.name) attendees.push(a.name)
      else if (a.email) attendees.push(a.email)
    })
  }

  const actionItems: string[] = []
  if (meeting.meeting_action_items) {
    meeting.meeting_action_items.forEach((item: any) => {
      if (item.title) actionItems.push(item.title)
    })
  }

  let sentimentLabel = 'neutral'
  if (meeting.sentiment_score !== null) {
    if (meeting.sentiment_score > 0.25) sentimentLabel = 'positive'
    else if (meeting.sentiment_score < -0.25) sentimentLabel = 'negative'
  }

  return {
    meeting_id: meeting.id,
    title: meeting.title || 'Untitled Meeting',
    date: meeting.meeting_start ? new Date(meeting.meeting_start).toISOString().split('T')[0] : '',
    company_name: meeting.company?.name || null,
    company_id: meeting.company_id || null,
    contact_name: meeting.primary_contact?.name || meeting.primary_contact?.email || null,
    contact_id: meeting.primary_contact_id || null,
    attendees,
    duration_minutes: meeting.duration_minutes,
    sentiment_score: meeting.sentiment_score,
    sentiment_label: sentimentLabel,
    sentiment_reasoning: meeting.sentiment_reasoning,
    transcript: meeting.transcript_text || '',
    summary: meeting.summary,
    action_items: actionItems,
    talk_time_rep_pct: meeting.talk_time_rep_pct,
    talk_time_customer_pct: meeting.talk_time_customer_pct
  }
}

/**
 * Upload document to File Search store
 */
async function uploadToFileSearch(
  storeName: string,
  meetingId: string,
  document: MeetingDocument,
  geminiApiKey: string
): Promise<string> {
  const content = JSON.stringify(document, null, 2)
  const contentBytes = new TextEncoder().encode(content)

  const customMetadata: Array<{ key: string; string_value?: string }> = []

  if (document.company_id) {
    customMetadata.push({ key: 'company_id', string_value: document.company_id })
  }
  if (document.sentiment_label) {
    customMetadata.push({ key: 'sentiment_label', string_value: document.sentiment_label })
  }
  if (document.date) {
    customMetadata.push({ key: 'meeting_date', string_value: document.date })
  }
  customMetadata.push({
    key: 'has_action_items',
    string_value: document.action_items.length > 0 ? 'true' : 'false'
  })

  const uploadResponse = await fetch(
    `${GEMINI_API_BASE}/${storeName}:uploadFile?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: {
          displayName: `meeting-${meetingId}`,
          mimeType: 'application/json'
        },
        config: {
          customMetadata
        },
        inlineData: {
          mimeType: 'application/json',
          data: btoa(String.fromCharCode(...contentBytes))
        }
      })
    }
  )

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    console.error(`File Search upload failed - Status: ${uploadResponse.status}, Body: ${errorText}`)
    throw new Error(`Failed to upload to File Search (${uploadResponse.status}): ${errorText || 'No error details'}`)
  }

  const uploadData = await uploadResponse.json()
  return uploadData.name || uploadData.file?.name || `${storeName}/files/${meetingId}`
}

/**
 * Process a single queue item
 */
async function processQueueItem(
  item: QueueItem,
  supabase: any,
  geminiApiKey: string
): Promise<ProcessResult> {
  try {
    // Update attempt count
    await supabase
      .from('meeting_index_queue')
      .update({
        attempts: item.attempts + 1,
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', item.id)

    // Get or create store for user
    const storeName = await getOrCreateStore(item.user_id, supabase, geminiApiKey)

    // Fetch meeting data (without ambiguous FK joins)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        meeting_start,
        duration_minutes,
        transcript_text,
        summary,
        sentiment_score,
        sentiment_reasoning,
        talk_time_rep_pct,
        talk_time_customer_pct,
        company_id,
        primary_contact_id,
        meeting_attendees(name, email, is_external),
        meeting_action_items(id, title, completed)
      `)
      .eq('id', item.meeting_id)
      .single()

    if (meetingError || !meeting) {
      throw new Error(`Meeting not found: ${meetingError?.message || 'Unknown error'}`)
    }

    // Fetch company separately to avoid FK ambiguity
    let company: { id: string; name: string } | null = null
    if (meeting.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', meeting.company_id)
        .single()
      company = companyData
    }

    // Fetch contact separately
    let primaryContact: { id: string; name: string; email: string } | null = null
    if (meeting.primary_contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, name, email')
        .eq('id', meeting.primary_contact_id)
        .single()
      primaryContact = contactData
    }

    // Attach to meeting object for buildMeetingDocument
    const meetingWithRelations = {
      ...meeting,
      company,
      primary_contact: primaryContact,
    }

    // Validate transcript
    if (!meeting.transcript_text || meeting.transcript_text.length < 100) {
      // Remove from queue - no transcript to index
      await supabase
        .from('meeting_index_queue')
        .delete()
        .eq('id', item.id)

      return {
        success: false,
        meeting_id: item.meeting_id,
        message: 'Meeting has no transcript or transcript too short - removed from queue'
      }
    }

    // Build document
    const document = buildMeetingDocument(meetingWithRelations)

    // Calculate content hash
    const contentStr = JSON.stringify(document)
    const encoder = new TextEncoder()
    const data = encoder.encode(contentStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Check if already indexed with same content
    const { data: existingIndex } = await supabase
      .from('meeting_file_search_index')
      .select('content_hash')
      .eq('meeting_id', item.meeting_id)
      .eq('user_id', item.user_id)
      .single()

    if (existingIndex?.content_hash === contentHash) {
      // Already indexed with same content - remove from queue
      await supabase
        .from('meeting_index_queue')
        .delete()
        .eq('id', item.id)

      return {
        success: true,
        meeting_id: item.meeting_id,
        message: 'Already indexed with same content'
      }
    }

    // Update index status to indexing
    await supabase
      .from('meeting_file_search_index')
      .upsert({
        meeting_id: item.meeting_id,
        user_id: item.user_id,
        store_name: storeName,
        status: 'indexing',
        content_hash: contentHash
      }, { onConflict: 'meeting_id,user_id' })

    // Upload to File Search
    const fileName = await uploadToFileSearch(storeName, item.meeting_id, document, geminiApiKey)

    // Update index status to indexed
    await supabase
      .from('meeting_file_search_index')
      .update({
        file_name: fileName,
        status: 'indexed',
        indexed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('meeting_id', item.meeting_id)
      .eq('user_id', item.user_id)

    // Update store file count
    const { data: indexCount } = await supabase
      .from('meeting_file_search_index')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', item.user_id)
      .eq('status', 'indexed')

    await supabase
      .from('user_file_search_stores')
      .update({
        total_files: indexCount?.count || 0,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', item.user_id)

    // Remove from queue
    await supabase
      .from('meeting_index_queue')
      .delete()
      .eq('id', item.id)

    return {
      success: true,
      meeting_id: item.meeting_id,
      message: 'Successfully indexed'
    }

  } catch (error) {
    // Update index status to failed
    await supabase
      .from('meeting_file_search_index')
      .upsert({
        meeting_id: item.meeting_id,
        user_id: item.user_id,
        store_name: '',
        status: 'failed',
        error_message: error.message
      }, { onConflict: 'meeting_id,user_id' })

    // Check if max attempts reached
    if (item.attempts + 1 >= item.max_attempts) {
      // Update queue item with error but don't delete (for debugging)
      await supabase
        .from('meeting_index_queue')
        .update({
          error_message: `Max attempts reached: ${error.message}`
        })
        .eq('id', item.id)
    }

    return {
      success: false,
      meeting_id: item.meeting_id,
      message: error.message
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse optional parameters
    let userId: string | null = null
    let limit = BATCH_SIZE

    try {
      const body = await req.json()
      userId = body.userId || null
      limit = Math.min(body.limit || BATCH_SIZE, 50)
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Create service role client for queue processing
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch queue items
    let query = supabaseClient
      .from('meeting_index_queue')
      .select('*')
      .lt('attempts', MAX_ATTEMPTS)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: queueItems, error: queueError } = await query

    if (queueError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue', details: queueError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No items in queue',
          processed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter items eligible for retry
    const eligibleItems = queueItems.filter(shouldRetry)

    if (eligibleItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No items eligible for processing (all in backoff)',
          queued: queueItems.length,
          processed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process items
    const results: ProcessResult[] = []

    for (const item of eligibleItems) {
      const result = await processQueueItem(item, supabaseClient, geminiApiKey)
      results.push(result)

      // Small delay between items to avoid rate limiting
      if (results.length < eligibleItems.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} items`,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in meeting-intelligence-process-queue:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
