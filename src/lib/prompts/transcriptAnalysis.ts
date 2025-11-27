/**
 * Transcript Analysis Prompts
 *
 * Extracts action items, analyzes talk time, and determines sentiment
 * from meeting transcripts.
 *
 * @file supabase/functions/fathom-sync/aiAnalysis.ts
 * @model claude-haiku-4-5-20251001 (configurable via CLAUDE_MODEL env var)
 * @temperature 0.5
 * @maxTokens 4096
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// System Prompt
// ============================================================================

export const TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT = `You are an expert sales call analyst who extracts actionable insights from meeting transcripts.

Your task is to analyze the transcript and extract:
1. Concrete action items that were agreed upon
2. Talk time analysis showing conversation balance
3. Sentiment analysis of the overall call

Be thorough but only include genuinely actionable items - not vague ideas or suggestions.`;

// ============================================================================
// User Prompt Template
// ============================================================================

export const TRANSCRIPT_ANALYSIS_USER_PROMPT = `Analyze this sales call transcript and extract structured information.

MEETING CONTEXT:
- Title: \${meetingTitle}
- Date: \${meetingDate}
- Host: \${ownerEmail}

TRANSCRIPT:
\${transcript}

Please analyze the transcript and provide:

1. ACTION ITEMS (ONLY concrete, agreed, assignable next steps):
   Extract action items that are clearly agreed upon and require action. Exclude ideas, suggestions, opinions, or vague topics.

   IMPORTANT: Look for BOTH explicit and implicit action items, but include ONLY if they represent a concrete next step:
   - Explicit: "I'll send you the proposal by Friday"
   - Implicit: "We need to review the contract" (creates action for someone)
   - Commitments: "We'll get back to you with those numbers"
   - Questions to follow up on: "Let me check with the team and circle back"
   - Next steps agreed upon: "Let's schedule a follow-up for next week"

   Extract action items for BOTH parties:
   - Sales Rep tasks: Things the rep/your team needs to do
   - Prospect/Customer tasks: Things the customer agreed to do

   Common action items to look for:
   - Send information (proposal, pricing, case studies, documentation)
   - Schedule meetings (demos, follow-ups, stakeholder calls)
   - Internal tasks (check with team, get approval, review documents)
   - Customer tasks (review materials, provide information, make decisions)
   - Technical items (set up integrations, provide access, configure)

   For each action item:
   - Title: Clear, specific description of what needs to be done
   - Assigned to: Person's name who should do it (sales rep name, customer name, or role like "Sales Team" or "Customer")
   - Assigned to email: Email address if mentioned, otherwise null
   - Deadline: Date when it's due (relative to \${meetingDate}). Parse phrases like:
     * "tomorrow" = 1 day from meeting date
     * "next week" = 7 days from meeting date
     * "end of week" = nearest Friday from meeting date
     * "by Friday" = nearest Friday from meeting date
     * "in 2 days" = 2 days from meeting date
     * If no deadline mentioned, use null
   - Category: Map to ONE of: call, email, meeting, follow_up, proposal, demo, general (use general for anything else)
   - Priority: Assess as high (urgent/time-sensitive), medium (important but flexible), or low (nice to have)
   - Confidence: How confident are you this is a real action item (0.0 to 1.0)
     * 0.9-1.0: Explicit commitment ("I will...")
     * 0.7-0.9: Strong indication ("We should...")
     * 0.5-0.7: Implied action ("That would be helpful...")
     * <0.5: Unclear or speculative

2. TALK TIME ANALYSIS:
   Analyze who spoke more during the call:
   - Rep percentage: Estimated % of time sales rep(s) spoke
   - Customer percentage: Estimated % of time customer(s) spoke
   - Assessment: Brief evaluation (e.g., "Balanced conversation", "Rep talked too much", "Good listening")

3. SENTIMENT ANALYSIS:
   Evaluate the overall tone and sentiment of the call:
   - Score: Overall sentiment from -1.0 (very negative) to 1.0 (very positive)
   - Reasoning: Brief explanation of why you gave this score
   - Key moments: List 2-3 significant positive or negative moments

Return ONLY valid JSON in this exact format and include ONLY 3-8 of the most important action items that meet the criteria:
{
  "actionItems": [
    {
      "title": "Send detailed pricing proposal with enterprise tier options",
      "assignedTo": "John Smith",
      "assignedToEmail": "john@company.com",
      "deadline": "2025-11-05",
      "category": "proposal",
      "priority": "high",
      "confidence": 0.95
    },
    {
      "title": "Schedule technical demo with engineering team",
      "assignedTo": "Sales Team",
      "assignedToEmail": null,
      "deadline": "2025-11-08",
      "category": "demo",
      "priority": "high",
      "confidence": 0.9
    },
    {
      "title": "Review proposal and provide feedback to team",
      "assignedTo": "Sarah Johnson",
      "assignedToEmail": "sarah@prospect.com",
      "deadline": "2025-11-10",
      "category": "follow_up",
      "priority": "medium",
      "confidence": 0.85
    },
    {
      "title": "Get budget approval from finance",
      "assignedTo": "Customer",
      "assignedToEmail": null,
      "deadline": null,
      "category": "general",
      "priority": "high",
      "confidence": 0.8
    }
  ],
  "talkTime": {
    "repPct": 45.5,
    "customerPct": 54.5,
    "assessment": "Well-balanced conversation with good listening"
  },
  "sentiment": {
    "score": 0.75,
    "reasoning": "Positive and engaged conversation with strong interest",
    "keyMoments": [
      "Customer expressed enthusiasm about the product",
      "Pricing concerns were addressed satisfactorily",
      "Clear next steps established"
    ]
  }
}

IMPORTANT:
- Return ONLY the JSON, no other text
- Use null for missing values
- Ensure all percentages sum to 100
- Include BOTH sales rep tasks AND customer/prospect tasks
- Exclude ideas or vague statements (e.g., "it might be good to...", "we could consider...")
- Only include items with clear ownership and a concrete verb (send, schedule, review, provide, decide, sign, integrate, configure, follow up)
- Prefer items with an explicit or reasonably inferred deadline
- Mark confidence appropriately; avoid items below 0.7 confidence
- If truly no action items found, return empty array (but this should be rare for sales calls)`;

// ============================================================================
// Variables
// ============================================================================

export const TRANSCRIPT_ANALYSIS_VARIABLES: PromptVariable[] = [
  {
    name: 'meetingTitle',
    description: 'Title of the meeting',
    type: 'string',
    required: true,
    example: 'Q4 Strategy Discussion',
    source: 'meetings',
  },
  {
    name: 'meetingDate',
    description: 'Date of the meeting (ISO format)',
    type: 'string',
    required: true,
    example: '2025-11-27',
    source: 'meetings',
  },
  {
    name: 'ownerEmail',
    description: 'Email of the meeting host',
    type: 'string',
    required: false,
    example: 'sales@company.com',
    source: 'meetings',
  },
  {
    name: 'transcript',
    description: 'Full meeting transcript text',
    type: 'string',
    required: true,
    example: '[Full transcript content...]',
    source: 'meetings',
  },
];

// ============================================================================
// Response Schema
// ============================================================================

export const TRANSCRIPT_ANALYSIS_RESPONSE_SCHEMA = `{
  "type": "object",
  "required": ["actionItems", "talkTime", "sentiment"],
  "properties": {
    "actionItems": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "category", "priority", "confidence"],
        "properties": {
          "title": { "type": "string" },
          "assignedTo": { "type": ["string", "null"] },
          "assignedToEmail": { "type": ["string", "null"] },
          "deadline": { "type": ["string", "null"], "format": "date" },
          "category": {
            "type": "string",
            "enum": ["call", "email", "meeting", "follow_up", "proposal", "demo", "general"]
          },
          "priority": {
            "type": "string",
            "enum": ["high", "medium", "low"]
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        }
      }
    },
    "talkTime": {
      "type": "object",
      "required": ["repPct", "customerPct", "assessment"],
      "properties": {
        "repPct": { "type": "number", "minimum": 0, "maximum": 100 },
        "customerPct": { "type": "number", "minimum": 0, "maximum": 100 },
        "assessment": { "type": "string" }
      }
    },
    "sentiment": {
      "type": "object",
      "required": ["score", "reasoning", "keyMoments"],
      "properties": {
        "score": { "type": "number", "minimum": -1, "maximum": 1 },
        "reasoning": { "type": "string" },
        "keyMoments": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 5
        }
      }
    }
  }
}`;

// ============================================================================
// Template Export
// ============================================================================

export const transcriptAnalysisTemplate: PromptTemplate = {
  id: 'transcript-analysis',
  name: 'Transcript Analysis',
  description: 'Extracts action items, analyzes talk time distribution, and determines sentiment from meeting transcripts.',
  featureKey: 'transcript_analysis',
  systemPrompt: TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT,
  userPrompt: TRANSCRIPT_ANALYSIS_USER_PROMPT,
  variables: TRANSCRIPT_ANALYSIS_VARIABLES,
  responseFormat: 'json',
  responseSchema: TRANSCRIPT_ANALYSIS_RESPONSE_SCHEMA,
};

// ============================================================================
// Response Types
// ============================================================================

export interface ActionItem {
  title: string;
  assignedTo: string | null;
  assignedToEmail: string | null;
  deadline: string | null;
  category: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

export interface TalkTimeAnalysis {
  repPct: number;
  customerPct: number;
  assessment: string;
}

export interface SentimentAnalysis {
  score: number;
  reasoning: string;
  keyMoments: string[];
}

export interface TranscriptAnalysisResponse {
  actionItems: ActionItem[];
  talkTime: TalkTimeAnalysis;
  sentiment: SentimentAnalysis;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and normalize a category value
 */
export function normalizeCategory(
  category: string
): ActionItem['category'] {
  const validCategories = ['call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general'];
  const normalized = String(category || 'general').toLowerCase().replace(/[- ]/g, '_');

  if (validCategories.includes(normalized)) {
    return normalized as ActionItem['category'];
  }

  return 'general';
}

/**
 * Validate and normalize a priority value
 */
export function normalizePriority(priority: string): ActionItem['priority'] {
  const normalized = String(priority || 'medium').toLowerCase();

  if (['high', 'medium', 'low'].includes(normalized)) {
    return normalized as ActionItem['priority'];
  }

  return 'medium';
}

/**
 * Calculate deadline date based on relative phrase
 */
export function calculateDeadlineFromPhrase(
  phrase: string,
  meetingDate: Date
): string | null {
  const lowerPhrase = phrase.toLowerCase();

  if (lowerPhrase.includes('tomorrow')) {
    const date = new Date(meetingDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }

  if (lowerPhrase.includes('next week')) {
    const date = new Date(meetingDate);
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }

  if (lowerPhrase.includes('end of week') || lowerPhrase.includes('by friday')) {
    const date = new Date(meetingDate);
    const dayOfWeek = date.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
    date.setDate(date.getDate() + daysUntilFriday);
    return date.toISOString().split('T')[0];
  }

  // Match "in X days" pattern
  const daysMatch = lowerPhrase.match(/in (\d+) days?/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(meetingDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse and validate the AI response
 */
export function parseTranscriptAnalysisResponse(
  content: string
): TranscriptAnalysisResponse {
  // Extract JSON from markdown code blocks if present
  let jsonText = content.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
  }

  const parsed = JSON.parse(jsonText);

  // Validate structure
  if (!parsed.actionItems || !Array.isArray(parsed.actionItems)) {
    throw new Error('Missing or invalid actionItems array');
  }
  if (!parsed.talkTime || typeof parsed.talkTime !== 'object') {
    throw new Error('Missing or invalid talkTime object');
  }
  if (!parsed.sentiment || typeof parsed.sentiment !== 'object') {
    throw new Error('Missing or invalid sentiment object');
  }

  // Normalize action items
  const actionItems: ActionItem[] = parsed.actionItems.map((item: any) => ({
    title: String(item.title || 'Untitled action item'),
    assignedTo: item.assignedTo || null,
    assignedToEmail: item.assignedToEmail || null,
    deadline: item.deadline || null,
    category: normalizeCategory(item.category),
    priority: normalizePriority(item.priority),
    confidence: Math.min(Math.max(Number(item.confidence || 0.5), 0), 1),
  }));

  // Normalize talk time
  const talkTime: TalkTimeAnalysis = {
    repPct: Math.min(Math.max(Number(parsed.talkTime.repPct || 50), 0), 100),
    customerPct: Math.min(Math.max(Number(parsed.talkTime.customerPct || 50), 0), 100),
    assessment: String(parsed.talkTime.assessment || 'Unable to assess'),
  };

  // Normalize sentiment
  const sentiment: SentimentAnalysis = {
    score: Math.min(Math.max(Number(parsed.sentiment.score || 0), -1), 1),
    reasoning: String(parsed.sentiment.reasoning || 'No reasoning provided'),
    keyMoments: Array.isArray(parsed.sentiment.keyMoments)
      ? parsed.sentiment.keyMoments.map(String).slice(0, 5)
      : [],
  };

  return { actionItems, talkTime, sentiment };
}
