/**
 * Generate Marketing Content Edge Function
 *
 * Uses Claude Sonnet 4.5 to generate high-quality marketing content (social posts,
 * blog articles, video scripts, email newsletters) from meeting transcripts based on
 * user-selected topics.
 *
 * Features:
 * - Content versioning with regeneration support
 * - Inline Fathom timestamp links in generated content
 * - Cost tracking and usage metrics
 * - Smart caching (returns existing content unless regenerate=true)
 * - Junction table for topic-content links
 * - Comprehensive error handling
 *
 * API: POST /generate-marketing-content
 * Body: {
 *   meeting_id: string,
 *   content_type: 'social' | 'blog' | 'video' | 'email',
 *   selected_topic_indices: number[],
 *   regenerate?: boolean
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildContentPrompt } from './prompts.ts'

// ============================================================================
// Types & Interfaces
// ============================================================================

interface RequestBody {
  meeting_id: string
  content_type: 'social' | 'blog' | 'video' | 'email'
  selected_topic_indices: number[]
  regenerate?: boolean
}

interface Topic {
  title: string
  description: string
  timestamp_seconds: number
}

interface GeneratedContent {
  id: string
  title: string
  content: string
  content_type: string
  version: number
}

interface GenerationMetadata {
  model_used: string
  tokens_used: number
  cost_cents: number
  cached: boolean
  topics_used: number
}

interface SuccessResponse {
  success: true
  content: GeneratedContent
  metadata: GenerationMetadata
}

interface ErrorResponse {
  success: false
  error: string
  details?: string
}

// ============================================================================
// Constants
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 8192
const TIMEOUT_MS = 120000 // 120 seconds (2 minutes) for longer content generation

// Pricing: Claude Sonnet 4.5 costs ~$3 per 1M input tokens, ~$15 per 1M output tokens
// Average generation: ~5K input + ~1K output ≈ 3 cents
const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000 // $3 per 1M tokens
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000 // $15 per 1M tokens

const VALID_CONTENT_TYPES = ['social', 'blog', 'video', 'email'] as const

// Transcript excerpt size (characters to include around each topic)
const EXCERPT_CONTEXT_CHARS = 1500

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Start timing
  const startTime = Date.now()

  try {
    // ========================================================================
    // 1. Request Validation
    // ========================================================================

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[generate-marketing-content] Missing authorization header')
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Missing authorization header' },
        401
      )
    }

    let body: RequestBody
    try {
      body = await req.json()
    } catch (error) {
      console.error('[generate-marketing-content] Invalid JSON body:', error)
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Invalid JSON in request body' },
        400
      )
    }

    const {
      meeting_id,
      content_type,
      selected_topic_indices,
      regenerate = false,
    } = body

    // Validate meeting_id
    if (!meeting_id || typeof meeting_id !== 'string') {
      console.error('[generate-marketing-content] Invalid meeting_id:', meeting_id)
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Invalid meeting_id: must be a valid UUID string' },
        400
      )
    }

    // Validate content_type
    if (!VALID_CONTENT_TYPES.includes(content_type)) {
      console.error('[generate-marketing-content] Invalid content_type:', content_type)
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: `Invalid content_type: must be one of ${VALID_CONTENT_TYPES.join(', ')}`,
        },
        400
      )
    }

    // Validate selected_topic_indices
    if (
      !Array.isArray(selected_topic_indices) ||
      selected_topic_indices.length === 0 ||
      !selected_topic_indices.every((idx) => typeof idx === 'number' && idx >= 0)
    ) {
      console.error(
        '[generate-marketing-content] Invalid selected_topic_indices:',
        selected_topic_indices
      )
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: 'Invalid selected_topic_indices: must be a non-empty array of non-negative integers',
        },
        400
      )
    }

    console.log(
      `[generate-marketing-content] Processing meeting ${meeting_id}, type: ${content_type}, topics: ${selected_topic_indices.join(',')} (regenerate: ${regenerate})`
    )

    // ========================================================================
    // 2. Initialize Supabase Client
    // ========================================================================

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get user from auth token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('[generate-marketing-content] User authentication failed:', userError)
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Authentication failed', details: userError?.message },
        401
      )
    }

    const userId = user.id

    // ========================================================================
    // 3. Check Cache (unless regenerate)
    // ========================================================================

    if (!regenerate) {
      const { data: cachedContent, error: cacheError } = await supabaseClient
        .from('meeting_generated_content')
        .select('id, title, content, content_type, version, model_used, tokens_used, cost_cents, created_at')
        .eq('meeting_id', meeting_id)
        .eq('content_type', content_type)
        .eq('is_latest', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (cachedContent && !cacheError) {
        console.log(
          `[generate-marketing-content] Cache hit for meeting ${meeting_id}, type ${content_type}`
        )

        const responseTime = Date.now() - startTime
        console.log(`[generate-marketing-content] Returned cached content in ${responseTime}ms`)

        return jsonResponse<SuccessResponse>({
          success: true,
          content: {
            id: cachedContent.id,
            title: cachedContent.title,
            content: cachedContent.content,
            content_type: cachedContent.content_type,
            version: cachedContent.version,
          },
          metadata: {
            model_used: cachedContent.model_used,
            tokens_used: cachedContent.tokens_used,
            cost_cents: cachedContent.cost_cents,
            cached: true,
            topics_used: selected_topic_indices.length,
          },
        })
      }

      console.log(`[generate-marketing-content] Cache miss for meeting ${meeting_id}, type ${content_type}`)
    } else {
      console.log(`[generate-marketing-content] Skipping cache due to regenerate=true`)
    }

    // ========================================================================
    // 4. Fetch Meeting and Verify Ownership
    // ========================================================================

    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, transcript_text, share_url, meeting_start')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      console.error('[generate-marketing-content] Meeting not found or access denied:', meetingError)
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Meeting not found or access denied' },
        404
      )
    }

    // Validate transcript availability
    if (!meeting.transcript_text || meeting.transcript_text.trim().length < 50) {
      console.error('[generate-marketing-content] No transcript available for meeting:', meeting_id)
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: 'This meeting does not have a transcript yet',
          details: 'Please wait for the transcript to be processed',
        },
        422
      )
    }

    // ========================================================================
    // 5. Fetch Extracted Topics
    // ========================================================================

    const { data: topicsData, error: topicsError } = await supabaseClient
      .from('meeting_content_topics')
      .select('id, topics')
      .eq('meeting_id', meeting_id)
      .is('deleted_at', null)
      .order('extraction_version', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (topicsError || !topicsData) {
      console.error('[generate-marketing-content] Topics not found:', topicsError)
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: 'No topics extracted for this meeting yet',
          details: 'Please run topic extraction first',
        },
        422
      )
    }

    const topicsExtractionId = topicsData.id
    const allTopics = topicsData.topics as Topic[]

    // Validate topic indices
    const invalidIndices = selected_topic_indices.filter((idx) => idx >= allTopics.length)
    if (invalidIndices.length > 0) {
      console.error('[generate-marketing-content] Invalid topic indices:', invalidIndices)
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: `Invalid topic indices: ${invalidIndices.join(', ')} (max index: ${allTopics.length - 1})`,
        },
        400
      )
    }

    const selectedTopics = selected_topic_indices.map((idx) => allTopics[idx])
    console.log(`[generate-marketing-content] Selected ${selectedTopics.length} topics`)

    // ========================================================================
    // 6. Build Transcript Excerpt
    // ========================================================================

    const transcriptExcerpt = buildTranscriptExcerpt(meeting.transcript_text, selectedTopics)

    // ========================================================================
    // 7. Call Claude API for Content Generation
    // ========================================================================

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      console.error('[generate-marketing-content] ANTHROPIC_API_KEY not configured')
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'AI service not configured' },
        500
      )
    }

    const fathomBaseUrl = meeting.share_url || `https://app.fathom.video/meetings/${meeting_id}`
    const meetingDate = meeting.meeting_start
      ? new Date(meeting.meeting_start).toLocaleDateString()
      : 'Unknown'

    const prompt = buildContentPrompt(content_type, {
      meetingTitle: meeting.title || 'Untitled Meeting',
      meetingDate,
      topics: selectedTopics,
      transcriptExcerpt,
      fathomBaseUrl,
    })

    let generatedText: string
    let tokensUsed = 0
    let inputTokens = 0
    let outputTokens = 0

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0.7, // Balanced for creative yet consistent content
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[generate-marketing-content] Claude API error:', response.status, errorText)

        // Retry logic for specific errors
        if (response.status === 429 || response.status === 503) {
          return jsonResponse<ErrorResponse>(
            {
              success: false,
              error: 'AI service temporarily unavailable',
              details: 'Please try again in a few moments',
            },
            503,
            { 'Retry-After': '10' }
          )
        }

        throw new Error(`Claude API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      generatedText = data.content[0]?.text || ''

      inputTokens = data.usage?.input_tokens || 0
      outputTokens = data.usage?.output_tokens || 0
      tokensUsed = inputTokens + outputTokens

      console.log(
        `[generate-marketing-content] Claude API success (${inputTokens} input, ${outputTokens} output tokens)`
      )
    } catch (error) {
      console.error('[generate-marketing-content] Claude API call failed:', error)

      if (error instanceof Error && error.name === 'AbortError') {
        return jsonResponse<ErrorResponse>(
          { success: false, error: 'Request timeout', details: 'AI processing took too long' },
          504
        )
      }

      return jsonResponse<ErrorResponse>(
        { success: false, error: 'AI service error', details: (error as Error).message },
        503,
        { 'Retry-After': '10' }
      )
    }

    // ========================================================================
    // 8. Parse Generated Content
    // ========================================================================

    const { title, content } = parseGeneratedContent(generatedText, content_type)

    console.log(`[generate-marketing-content] Generated content: ${content.length} chars`)

    // ========================================================================
    // 9. Calculate Cost
    // ========================================================================

    const costCents = Math.ceil(
      inputTokens * INPUT_COST_PER_TOKEN * 100 + outputTokens * OUTPUT_COST_PER_TOKEN * 100
    )

    console.log(
      `[generate-marketing-content] Estimated cost: ${costCents} cents ($${(costCents / 100).toFixed(4)})`
    )

    // ========================================================================
    // 10. Store in Database with Versioning
    // ========================================================================

    // Use service role for database writes
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get existing content for versioning
    const { data: existing } = await supabaseServiceClient
      .from('meeting_generated_content')
      .select('id, version')
      .eq('meeting_id', meeting_id)
      .eq('content_type', content_type)
      .eq('is_latest', true)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = existing ? existing.version + 1 : 1
    const parentId = existing?.id || null

    // If regenerating, mark previous version as not latest
    if (existing) {
      await supabaseServiceClient
        .from('meeting_generated_content')
        .update({ is_latest: false })
        .eq('id', existing.id)
    }

    // Insert new content
    const { data: insertedContent, error: insertError } = await supabaseServiceClient
      .from('meeting_generated_content')
      .insert({
        meeting_id,
        content_type,
        title,
        content,
        version: newVersion,
        parent_id: parentId,
        is_latest: true,
        model_used: MODEL,
        tokens_used: tokensUsed,
        cost_cents: costCents,
        created_by: userId,
      })
      .select('id')
      .single()

    if (insertError || !insertedContent) {
      console.error('[generate-marketing-content] Database insert failed:', insertError)
      return jsonResponse<ErrorResponse>(
        { success: false, error: 'Failed to store content', details: insertError?.message },
        500
      )
    }

    const contentId = insertedContent.id

    console.log(`[generate-marketing-content] Stored content (version ${newVersion}) with ID: ${contentId}`)

    // ========================================================================
    // 11. Store Topic Links in Junction Table
    // ========================================================================

    const topicLinks = selected_topic_indices.map((topicIndex) => ({
      generated_content_id: contentId,
      topics_extraction_id: topicsExtractionId,
      topic_index: topicIndex,
    }))

    const { error: linksError } = await supabaseServiceClient
      .from('content_topic_links')
      .insert(topicLinks)

    if (linksError) {
      console.error('[generate-marketing-content] Failed to store topic links:', linksError)
      // Non-fatal error - content was still created
    } else {
      console.log(`[generate-marketing-content] Stored ${topicLinks.length} topic links`)
    }

    // ========================================================================
    // 12. Return Success Response
    // ========================================================================

    const responseTime = Date.now() - startTime
    console.log(`[generate-marketing-content] Completed in ${responseTime}ms`)

    return jsonResponse<SuccessResponse>({
      success: true,
      content: {
        id: contentId,
        title,
        content,
        content_type,
        version: newVersion,
      },
      metadata: {
        model_used: MODEL,
        tokens_used: tokensUsed,
        cost_cents: costCents,
        cached: false,
        topics_used: selectedTopics.length,
      },
    })
  } catch (error) {
    console.error('[generate-marketing-content] Unexpected error:', error)
    return jsonResponse<ErrorResponse>(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      500
    )
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build transcript excerpt around selected topics
 */
function buildTranscriptExcerpt(transcript: string, topics: Topic[]): string {
  // For simplicity, include full transcript if reasonable size
  // In production, you could implement smarter extraction around timestamps
  if (transcript.length <= 20000) {
    return transcript
  }

  // For very long transcripts, take first 10K chars as context
  return transcript.substring(0, 10000) + '\n\n[... transcript continues ...]'
}

/**
 * Parse generated content to extract title and body
 */
function parseGeneratedContent(
  generatedText: string,
  contentType: string
): { title: string; content: string } {
  const lines = generatedText.trim().split('\n')

  // Look for markdown heading as title (# Title or ## Title)
  const headingMatch = lines.find((line) => line.match(/^#{1,2}\s+.+/))

  if (headingMatch) {
    const title = headingMatch.replace(/^#{1,2}\s+/, '').trim()
    // Remove the title line from content
    const contentLines = lines.filter(line => line !== headingMatch)
    const content = contentLines.join('\n').trim()

    return { title, content }
  }

  // For social posts, first line is often the hook
  if (contentType === 'social') {
    const firstLine = lines[0]?.trim() || 'Untitled Social Post'
    const title = firstLine.substring(0, 80) // Truncate if too long
    return { title, content: generatedText.trim() }
  }

  // Default: use content type as title
  const defaultTitles = {
    social: 'Social Media Post',
    blog: 'Blog Article',
    video: 'Video Script',
    email: 'Email Newsletter',
  }

  return {
    title: defaultTitles[contentType as keyof typeof defaultTitles] || 'Generated Content',
    content: generatedText.trim(),
  }
}

/**
 * Helper to create JSON responses with consistent headers
 */
function jsonResponse<T>(
  data: T,
  status = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  })
}
