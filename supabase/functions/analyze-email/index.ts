/**
 * Edge Function: Analyze Email with AI
 *
 * Uses Claude Haiku 4.5 to analyze sales emails for CRM health tracking.
 * Extracts sentiment, topics, action items, urgency, and response requirements.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface EmailAnalysisRequest {
  subject: string;
  body: string;
}

interface EmailAnalysisResponse {
  sentiment_score: number; // -1 to 1
  key_topics: string[];
  action_items: string[];
  urgency: 'low' | 'medium' | 'high';
  response_required: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildAnalysisPrompt(subject: string, body: string): string {
  return `Analyze this sales email for CRM health tracking.

SUBJECT: ${subject}

BODY:
${body}

Provide a JSON response with:
1. sentiment_score: Number from -1 (very negative) to 1 (very positive)
2. key_topics: Array of 2-5 main topics discussed (e.g., ["pricing", "timeline", "product features"])
3. action_items: Array of any action items mentioned (e.g., ["Schedule follow-up call", "Send proposal"])
4. urgency: "low", "medium", or "high" based on time-sensitive language
5. response_required: Boolean indicating if sender expects a response

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "sentiment_score": 0.5,
  "key_topics": ["topic1", "topic2"],
  "action_items": ["action1"],
  "urgency": "medium",
  "response_required": true
}`;
}

function parseClaudeResponse(content: string): EmailAnalysisResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize the response
  return {
    sentiment_score: Math.max(-1, Math.min(1, Number(parsed.sentiment_score) || 0)),
    key_topics: Array.isArray(parsed.key_topics) ? parsed.key_topics.slice(0, 5) : [],
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    urgency: ['low', 'medium', 'high'].includes(parsed.urgency) ? parsed.urgency : 'low',
    response_required: Boolean(parsed.response_required),
  };
}

async function analyzeEmailWithAI(request: EmailAnalysisRequest): Promise<EmailAnalysisResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = buildAnalysisPrompt(request.subject, request.body);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20250514',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  return parseClaudeResponse(content);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { subject, body } = await req.json();

    if (!subject && !body) {
      return new Response(
        JSON.stringify({ error: 'Email subject or body is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = await analyzeEmailWithAI({
      subject: subject || '',
      body: body || '',
    });

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email analysis error:', error);

    // Return fallback analysis on error
    return new Response(
      JSON.stringify({
        error: error.message || 'Analysis failed',
        fallback: {
          sentiment_score: 0,
          key_topics: [],
          action_items: [],
          urgency: 'low',
          response_required: false,
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
