/**
 * Email Analysis Prompts
 *
 * Analyzes sales emails for CRM health tracking - extracts sentiment,
 * topics, action items, and urgency.
 *
 * @file supabase/functions/analyze-email/index.ts
 * @model claude-haiku-4-5-20250514
 * @temperature 0.3
 * @maxTokens 1024
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// System Prompt
// ============================================================================

export const EMAIL_ANALYSIS_SYSTEM_PROMPT = `You are an expert email analyst who extracts key insights from sales communications.

Your task is to analyze email content and provide structured data for CRM health tracking.

Focus on:
- Overall sentiment and tone
- Main topics discussed
- Action items mentioned
- Urgency indicators
- Response expectations`;

// ============================================================================
// User Prompt Template
// ============================================================================

export const EMAIL_ANALYSIS_USER_PROMPT = `Analyze this sales email for CRM health tracking.

SUBJECT: \${subject}

BODY:
\${body}

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

// ============================================================================
// Variables
// ============================================================================

export const EMAIL_ANALYSIS_VARIABLES: PromptVariable[] = [
  {
    name: 'subject',
    description: 'Email subject line',
    type: 'string',
    required: false,
    example: 'Re: Q4 Proposal Follow-up',
    source: 'request',
  },
  {
    name: 'body',
    description: 'Email body content',
    type: 'string',
    required: true,
    example: 'Hi John, Thanks for sending over the proposal...',
    source: 'request',
  },
];

// ============================================================================
// Response Schema
// ============================================================================

export const EMAIL_ANALYSIS_RESPONSE_SCHEMA = `{
  "type": "object",
  "required": ["sentiment_score", "key_topics", "action_items", "urgency", "response_required"],
  "properties": {
    "sentiment_score": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Overall sentiment from -1 (negative) to 1 (positive)"
    },
    "key_topics": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 2,
      "maxItems": 5,
      "description": "Main topics discussed in the email"
    },
    "action_items": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Action items mentioned in the email"
    },
    "urgency": {
      "type": "string",
      "enum": ["low", "medium", "high"],
      "description": "Urgency level based on time-sensitive language"
    },
    "response_required": {
      "type": "boolean",
      "description": "Whether the sender expects a response"
    }
  }
}`;

// ============================================================================
// Template Export
// ============================================================================

export const emailAnalysisTemplate: PromptTemplate = {
  id: 'email-analysis',
  name: 'Email Analysis',
  description: 'Analyzes sales emails to extract sentiment, key topics, action items, urgency, and response requirements.',
  featureKey: 'email_analysis',
  systemPrompt: EMAIL_ANALYSIS_SYSTEM_PROMPT,
  userPrompt: EMAIL_ANALYSIS_USER_PROMPT,
  variables: EMAIL_ANALYSIS_VARIABLES,
  responseFormat: 'json',
  responseSchema: EMAIL_ANALYSIS_RESPONSE_SCHEMA,
};

// ============================================================================
// Response Types
// ============================================================================

export interface EmailAnalysisResponse {
  sentiment_score: number;
  key_topics: string[];
  action_items: string[];
  urgency: 'low' | 'medium' | 'high';
  response_required: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate the email analysis response
 */
export function parseEmailAnalysisResponse(content: string): EmailAnalysisResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
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

/**
 * Get urgency keywords for detection
 */
export function getUrgencyIndicators(): {
  high: string[];
  medium: string[];
  low: string[];
} {
  return {
    high: [
      'urgent',
      'asap',
      'immediately',
      'critical',
      'deadline',
      'today',
      'end of day',
      'eod',
      'time-sensitive',
      'priority',
    ],
    medium: [
      'soon',
      'this week',
      'by friday',
      'next few days',
      'timely',
      'important',
      'follow up',
    ],
    low: [
      'when you get a chance',
      'no rush',
      'whenever',
      'at your convenience',
      'when possible',
    ],
  };
}

/**
 * Detect urgency from email content (can be used for pre-processing)
 */
export function detectUrgency(text: string): 'low' | 'medium' | 'high' {
  const lowerText = text.toLowerCase();
  const indicators = getUrgencyIndicators();

  for (const keyword of indicators.high) {
    if (lowerText.includes(keyword)) {
      return 'high';
    }
  }

  for (const keyword of indicators.medium) {
    if (lowerText.includes(keyword)) {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Check if email expects a response (simple heuristic)
 */
export function detectResponseRequired(text: string): boolean {
  const lowerText = text.toLowerCase();

  const responseIndicators = [
    'let me know',
    'please respond',
    'please reply',
    'get back to me',
    'thoughts?',
    'what do you think',
    'looking forward to hearing',
    'awaiting your response',
    'please advise',
    '?', // Questions typically expect responses
  ];

  return responseIndicators.some(indicator => lowerText.includes(indicator));
}
