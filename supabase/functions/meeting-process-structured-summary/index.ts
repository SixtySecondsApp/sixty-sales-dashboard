/**
 * Meeting Process Structured Summary Edge Function
 *
 * Extracts structured data from meeting transcripts using Claude AI:
 * - Key decisions
 * - Rep/prospect commitments
 * - Stakeholders mentioned
 * - Pricing discussions
 * - Technical requirements
 * - Outcome signals (forward movement)
 * - Stage indicators
 * - Competitor mentions
 * - Objections
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

interface RequestBody {
  meetingId: string;
  forceReprocess?: boolean;
}

interface StructuredSummary {
  key_decisions: Array<{ decision: string; context: string; importance: 'high' | 'medium' | 'low' }>;
  rep_commitments: Array<{ commitment: string; due_date?: string; priority: 'high' | 'medium' | 'low' }>;
  prospect_commitments: Array<{ commitment: string; expectation?: string }>;
  stakeholders_mentioned: Array<{ name: string; role?: string; concerns: string[]; sentiment: 'positive' | 'neutral' | 'negative' }>;
  pricing_discussed: { mentioned: boolean; amount?: number; structure?: string; objections?: string[]; notes?: string };
  technical_requirements: Array<{ requirement: string; priority: 'high' | 'medium' | 'low'; notes?: string }>;
  outcome_signals: {
    overall: 'positive' | 'negative' | 'neutral';
    positive_signals: string[];
    negative_signals: string[];
    next_steps: string[];
    forward_movement: boolean;
  };
  stage_indicators: {
    detected_stage: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general';
    confidence: number;
    signals: string[];
  };
  competitor_mentions: Array<{ name: string; context: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
  objections: Array<{ objection: string; response?: string; resolved: boolean; category?: string }>;
}

const EXTRACTION_PROMPT = `You are a sales meeting analyst. Analyze the following sales meeting transcript and extract structured data.

TRANSCRIPT:
{transcript}

MEETING CONTEXT:
- Title: {title}
- Company: {company_name}
- Deal Stage: {deal_stage}
- Attendees: {attendees}

Extract the following information in JSON format:

{
  "key_decisions": [
    {"decision": "string", "context": "string", "importance": "high|medium|low"}
  ],
  "rep_commitments": [
    {"commitment": "string", "due_date": "optional YYYY-MM-DD", "priority": "high|medium|low"}
  ],
  "prospect_commitments": [
    {"commitment": "string", "expectation": "optional string"}
  ],
  "stakeholders_mentioned": [
    {"name": "string", "role": "optional string", "concerns": ["array of concerns"], "sentiment": "positive|neutral|negative"}
  ],
  "pricing_discussed": {
    "mentioned": boolean,
    "amount": optional number,
    "structure": "optional string describing pricing structure",
    "objections": ["optional array of pricing objections"],
    "notes": "optional string"
  },
  "technical_requirements": [
    {"requirement": "string", "priority": "high|medium|low", "notes": "optional string"}
  ],
  "outcome_signals": {
    "overall": "positive|negative|neutral",
    "positive_signals": ["array of positive indicators"],
    "negative_signals": ["array of negative indicators"],
    "next_steps": ["array of agreed next steps"],
    "forward_movement": boolean (true if prospect indicated willingness to proceed)
  },
  "stage_indicators": {
    "detected_stage": "discovery|demo|negotiation|closing|follow_up|general",
    "confidence": 0.0-1.0,
    "signals": ["array of signals that indicate this stage"]
  },
  "competitor_mentions": [
    {"name": "string", "context": "string describing what was said", "sentiment": "positive|neutral|negative"}
  ],
  "objections": [
    {"objection": "string", "response": "optional string", "resolved": boolean, "category": "optional string like budget/timeline/authority/need"}
  ]
}

Important guidelines:
- Only include information explicitly stated or strongly implied in the transcript
- For forward_movement, look for signals like: interest in next steps, asking about implementation, requesting proposals, expressing urgency
- For negative signals, look for: hesitation, budget concerns, timeline delays, competitor mentions
- Be conservative with confidence scores
- If pricing wasn't discussed, set pricing_discussed.mentioned to false
- If no competitors were mentioned, return an empty array for competitor_mentions

Return ONLY valid JSON, no additional text.`;

/**
 * Call Claude API to extract structured summary
 */
async function extractStructuredSummary(
  transcript: string,
  title: string,
  companyName: string,
  dealStage: string,
  attendees: string[]
): Promise<{ summary: StructuredSummary; tokensUsed: number }> {
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Truncate transcript if too long (max ~50K chars to leave room for response)
  const maxTranscriptLength = 50000;
  const truncatedTranscript = transcript.length > maxTranscriptLength
    ? transcript.substring(0, maxTranscriptLength) + '\n\n[Transcript truncated due to length...]'
    : transcript;

  const prompt = EXTRACTION_PROMPT
    .replace('{transcript}', truncatedTranscript)
    .replace('{title}', title || 'Unknown')
    .replace('{company_name}', companyName || 'Unknown')
    .replace('{deal_stage}', dealStage || 'Unknown')
    .replace('{attendees}', attendees.join(', ') || 'Unknown');

  const startTime = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.1,
      system: 'You are a sales meeting analyst. Extract structured data from meeting transcripts. Return only valid JSON.',
      messages: [{
        role: 'user',
        content: prompt,
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text;
  const tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);

  // Parse JSON response
  let summary: StructuredSummary;
  try {
    // Handle potential markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    summary = JSON.parse(jsonContent.trim());
  } catch (parseError) {
    console.error('Failed to parse Claude response:', content);
    throw new Error('Failed to parse AI response as JSON');
  }

  return { summary, tokensUsed };
}

/**
 * Get meeting data with related info
 */
async function getMeetingData(
  supabase: ReturnType<typeof createClient>,
  meetingId: string
): Promise<any> {
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select(`
      id,
      title,
      transcript_text,
      summary,
      owner_user_id,
      company_id,
      primary_contact_id,
      start_time,
      sentiment_score,
      meeting_attendees(name, email, is_external)
    `)
    .eq('id', meetingId)
    .single();

  if (error || !meeting) {
    throw new Error(`Meeting not found: ${error?.message || 'Unknown error'}`);
  }

  // Get company name
  let companyName = null;
  if (meeting.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', meeting.company_id)
      .single();
    companyName = company?.name;
  }

  // Get deal stage if there's an associated deal
  let dealStage = null;
  if (companyName) {
    const { data: deal } = await supabase
      .from('deals')
      .select('stage')
      .ilike('title', `%${companyName}%`)
      .eq('user_id', meeting.owner_user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    dealStage = deal?.stage;
  }

  // Get user's org_id
  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('org_id')
    .eq('user_id', meeting.owner_user_id)
    .limit(1)
    .single();

  return {
    ...meeting,
    company_name: companyName,
    deal_stage: dealStage,
    org_id: membership?.org_id,
  };
}

/**
 * Save structured summary to database
 */
async function saveStructuredSummary(
  supabase: ReturnType<typeof createClient>,
  meetingId: string,
  orgId: string,
  summary: StructuredSummary,
  tokensUsed: number,
  processingTimeMs: number
): Promise<void> {
  const { error } = await supabase
    .from('meeting_structured_summaries')
    .upsert({
      meeting_id: meetingId,
      org_id: orgId,
      key_decisions: summary.key_decisions,
      rep_commitments: summary.rep_commitments,
      prospect_commitments: summary.prospect_commitments,
      stakeholders_mentioned: summary.stakeholders_mentioned,
      pricing_discussed: summary.pricing_discussed,
      technical_requirements: summary.technical_requirements,
      outcome_signals: summary.outcome_signals,
      stage_indicators: summary.stage_indicators,
      competitor_mentions: summary.competitor_mentions,
      objections: summary.objections,
      ai_model_used: 'claude-sonnet-4-20250514',
      tokens_used: tokensUsed,
      processing_time_ms: processingTimeMs,
      version: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'meeting_id' });

  if (error) {
    throw new Error(`Failed to save structured summary: ${error.message}`);
  }
}

/**
 * Save meeting classification for aggregate queries
 */
async function saveMeetingClassification(
  supabase: ReturnType<typeof createClient>,
  meetingId: string,
  orgId: string,
  summary: StructuredSummary
): Promise<void> {
  const classification = {
    meeting_id: meetingId,
    org_id: orgId,
    has_forward_movement: summary.outcome_signals.forward_movement,
    has_proposal_request: summary.outcome_signals.next_steps.some(
      s => s.toLowerCase().includes('proposal') || s.toLowerCase().includes('quote')
    ),
    has_pricing_discussion: summary.pricing_discussed.mentioned,
    has_competitor_mention: summary.competitor_mentions.length > 0,
    has_objection: summary.objections.length > 0,
    has_demo_request: summary.outcome_signals.next_steps.some(
      s => s.toLowerCase().includes('demo') || s.toLowerCase().includes('walkthrough')
    ),
    has_timeline_discussion: summary.pricing_discussed.notes?.toLowerCase().includes('timeline') ||
      summary.objections.some(o => o.category === 'timeline'),
    has_budget_discussion: summary.pricing_discussed.mentioned ||
      summary.objections.some(o => o.category === 'budget'),
    has_decision_maker: summary.stakeholders_mentioned.some(s =>
      s.role?.toLowerCase().includes('decision') ||
      s.role?.toLowerCase().includes('ceo') ||
      s.role?.toLowerCase().includes('cto') ||
      s.role?.toLowerCase().includes('vp')
    ),
    has_next_steps: summary.outcome_signals.next_steps.length > 0,
    outcome: summary.outcome_signals.overall,
    detected_stage: summary.stage_indicators.detected_stage,
    topics: summary.technical_requirements.map(r => ({
      topic: r.requirement,
      confidence: 0.8,
      mentions: 1,
    })),
    objections: summary.objections,
    competitors: summary.competitor_mentions,
    keywords: [
      ...summary.key_decisions.map(d => d.decision.substring(0, 50)),
      ...summary.outcome_signals.positive_signals.slice(0, 3),
    ],
    objection_count: summary.objections.length,
    competitor_mention_count: summary.competitor_mentions.length,
    positive_signal_count: summary.outcome_signals.positive_signals.length,
    negative_signal_count: summary.outcome_signals.negative_signals.length,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('meeting_classifications')
    .upsert(classification, { onConflict: 'meeting_id' });

  if (error) {
    console.error('Failed to save meeting classification:', error);
    // Don't throw - classification is supplementary
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { meetingId, forceReprocess = false }: RequestBody = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Missing meetingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already processed (unless forcing)
    if (!forceReprocess) {
      const { data: existing } = await supabase
        .from('meeting_structured_summaries')
        .select('id, updated_at')
        .eq('meeting_id', meetingId)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Already processed',
            summary_id: existing.id,
            processed_at: existing.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get meeting data
    const meeting = await getMeetingData(supabase, meetingId);

    if (!meeting.transcript_text || meeting.transcript_text.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Meeting has no transcript or transcript too short' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!meeting.org_id) {
      return new Response(
        JSON.stringify({ error: 'User is not a member of any organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract attendee names
    const attendees = meeting.meeting_attendees?.map((a: any) => a.name || a.email) || [];

    // Extract structured summary using Claude
    const startTime = Date.now();
    const { summary, tokensUsed } = await extractStructuredSummary(
      meeting.transcript_text,
      meeting.title,
      meeting.company_name,
      meeting.deal_stage,
      attendees
    );
    const processingTimeMs = Date.now() - startTime;

    // Save to database
    await saveStructuredSummary(
      supabase,
      meetingId,
      meeting.org_id,
      summary,
      tokensUsed,
      processingTimeMs
    );

    // Save classification for aggregate queries
    await saveMeetingClassification(supabase, meetingId, meeting.org_id, summary);

    console.log(`Processed structured summary for meeting ${meetingId} in ${processingTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meetingId,
        summary,
        tokens_used: tokensUsed,
        processing_time_ms: processingTimeMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meeting-process-structured-summary:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
