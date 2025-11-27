/**
 * Suggest Next Actions Prompts
 *
 * Analyzes sales activities (meetings, calls, emails, proposals) to generate
 * intelligent next-action suggestions with reasoning.
 *
 * @file supabase/functions/suggest-next-actions/index.ts
 * @model claude-haiku-4-5-20251001 (configurable via CLAUDE_MODEL env var)
 * @temperature 0.7
 * @maxTokens 2048
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// System Prompt
// ============================================================================

export const SUGGEST_NEXT_ACTIONS_SYSTEM_PROMPT = `You are an expert sales AI assistant analyzing customer interactions to suggest the most effective next actions for sales representatives.

Your goal is to analyze the activity context and recommend 2-4 specific, actionable next steps that will move the deal forward.

Consider:
- Buying signals and concerns mentioned
- Current deal stage and momentum
- Time-sensitive opportunities
- Relationship building needs
- Objection handling requirements

For each suggestion, provide:
1. Task category - MUST be one of: call, email, meeting, follow_up, proposal, demo, general
2. Clear, actionable title (what to do)
3. Detailed reasoning (why this action matters based on the context)
4. Urgency level (low, medium, high)
5. Recommended deadline (realistic ISO 8601 date based on urgency and context)
6. Confidence score (0.0 to 1.0)
7. Timestamp (optional) - If you can identify roughly when this topic was discussed in the transcript, estimate the time in seconds from the start of the meeting

**Task Category Guidelines**:
- "call" - Phone calls to prospect/customer
- "email" - Email communications (proposals, ROI docs, follow-ups)
- "meeting" - Schedule demos, strategy sessions, reviews
- "follow_up" - General follow-up on previous discussions
- "proposal" - Create and send formal proposals
- "demo" - Product demonstrations or technical deep-dives
- "general" - Other tasks not fitting above categories

**Deadline Guidelines**:
- High urgency: 1-2 days
- Medium urgency: 3-5 days
- Low urgency: 1-2 weeks
- Consider mentioned timeframes (e.g., "budget meeting Friday" = set deadline before Friday)

**Timestamp Guidelines**:
- If the transcript shows when a topic was discussed, estimate the seconds from start
- This helps users jump to the relevant part of the recording
- If unsure, omit the timestamp field (better to have no timestamp than wrong timestamp)

Return ONLY a valid JSON array with no additional text.`;

// ============================================================================
// User Prompt Template
// ============================================================================

export const SUGGEST_NEXT_ACTIONS_USER_PROMPT = `Analyze this sales activity and suggest 2-4 next actions:

Activity Type: \${activityType}
Title: \${activityTitle}
\${companySection}
\${dealSection}
\${contactSection}
\${contentSection}
\${recentActivitiesSection}
\${existingContextSection}

Return suggestions as a JSON array following this exact structure:
[
  {
    "task_category": "email",
    "title": "Send ROI calculator within 24 hours",
    "reasoning": "Customer expressed concerns about ROI during the call. Specifically mentioned wanting to see numbers before next budget meeting on Friday. Providing calculator now addresses their primary objection and keeps momentum.",
    "urgency": "high",
    "recommended_deadline": "\${exampleDeadline}",
    "confidence_score": 0.85,
    "timestamp_seconds": 450
  }
]

IMPORTANT:
- Use "task_category" not "action_type". Valid categories: call, email, meeting, follow_up, proposal, demo, general
- Include "timestamp_seconds" if you can identify when this was discussed (omit if unsure)
- timestamp_seconds should be the approximate seconds from start of meeting`;

// ============================================================================
// Variables
// ============================================================================

export const SUGGEST_NEXT_ACTIONS_VARIABLES: PromptVariable[] = [
  {
    name: 'activityType',
    description: 'Type of activity (meeting, activity, email, proposal, call)',
    type: 'string',
    required: true,
    example: 'meeting',
    source: 'request',
  },
  {
    name: 'activityTitle',
    description: 'Title of the activity or meeting',
    type: 'string',
    required: false,
    example: 'Q4 Strategy Discussion',
    source: 'meetings/activities',
  },
  {
    name: 'companySection',
    description: 'Company information section (name, domain, size)',
    type: 'string',
    required: false,
    example: 'Company Information:\\n- Name: Acme Corp\\n- Domain: acme.com\\n- Size: 50-100',
    source: 'companies',
  },
  {
    name: 'dealSection',
    description: 'Deal information section (title, stage, value)',
    type: 'string',
    required: false,
    example: 'Deal Information:\\n- Title: Enterprise License\\n- Stage: Opportunity\\n- Value: $50,000',
    source: 'deals',
  },
  {
    name: 'contactSection',
    description: 'Primary contact information (name, title)',
    type: 'string',
    required: false,
    example: 'Primary Contact:\\n- Name: John Smith\\n- Title: VP of Sales',
    source: 'contacts',
  },
  {
    name: 'contentSection',
    description: 'Main content (transcript, summary, or notes)',
    type: 'string',
    required: true,
    example: 'Full Meeting Transcript:\\n[transcript content...]',
    source: 'meetings/activities',
  },
  {
    name: 'recentActivitiesSection',
    description: 'Recent activity history (last 30 days)',
    type: 'string',
    required: false,
    example: 'Recent Activity History (last 30 days):\\n1. [email] 2025-11-25: Sent proposal\\n2. [call] 2025-11-20: Discovery call',
    source: 'activities',
  },
  {
    name: 'existingContextSection',
    description: 'Existing suggestions and tasks to avoid duplicates',
    type: 'string',
    required: false,
    example: 'EXISTING TASKS AND SUGGESTIONS TO AVOID DUPLICATES:\\nPreviously Suggested Actions:\\n1. [email] Send proposal (Status: pending)',
    source: 'next_action_suggestions/tasks',
  },
  {
    name: 'exampleDeadline',
    description: 'Example ISO 8601 deadline for the JSON example',
    type: 'string',
    required: true,
    example: '2025-11-28T00:00:00.000Z',
    source: 'computed',
  },
];

// ============================================================================
// Response Schema
// ============================================================================

export const SUGGEST_NEXT_ACTIONS_RESPONSE_SCHEMA = `{
  "type": "array",
  "items": {
    "type": "object",
    "required": ["task_category", "title", "reasoning", "urgency", "recommended_deadline", "confidence_score"],
    "properties": {
      "task_category": {
        "type": "string",
        "enum": ["call", "email", "meeting", "follow_up", "proposal", "demo", "general"]
      },
      "title": {
        "type": "string",
        "description": "Clear, actionable title describing what to do"
      },
      "reasoning": {
        "type": "string",
        "description": "Detailed explanation of why this action matters"
      },
      "urgency": {
        "type": "string",
        "enum": ["low", "medium", "high"]
      },
      "recommended_deadline": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 formatted deadline"
      },
      "confidence_score": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "Confidence level from 0.0 to 1.0"
      },
      "timestamp_seconds": {
        "type": "number",
        "description": "Optional: seconds from start of meeting when discussed"
      }
    }
  }
}`;

// ============================================================================
// Template Export
// ============================================================================

export const suggestNextActionsTemplate: PromptTemplate = {
  id: 'suggest-next-actions',
  name: 'Suggest Next Actions',
  description: 'Analyzes sales activities to generate intelligent next-action suggestions with reasoning, urgency, and deadlines.',
  featureKey: 'suggest_next_actions',
  systemPrompt: SUGGEST_NEXT_ACTIONS_SYSTEM_PROMPT,
  userPrompt: SUGGEST_NEXT_ACTIONS_USER_PROMPT,
  variables: SUGGEST_NEXT_ACTIONS_VARIABLES,
  responseFormat: 'json',
  responseSchema: SUGGEST_NEXT_ACTIONS_RESPONSE_SCHEMA,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the company section for the prompt
 */
export function buildCompanySection(company?: {
  name?: string;
  domain?: string;
  size?: string;
}): string {
  if (!company?.name) return '';

  return `
Company Information:
- Name: ${company.name}
- Domain: ${company.domain || 'N/A'}
- Size: ${company.size || 'N/A'}`;
}

/**
 * Build the deal section for the prompt
 */
export function buildDealSection(deal?: {
  title?: string;
  stage?: string;
  value?: number;
}): string {
  if (!deal?.title) return '';

  return `
Deal Information:
- Title: ${deal.title}
- Stage: ${deal.stage || 'N/A'}
- Value: $${deal.value?.toLocaleString() || '0'}`;
}

/**
 * Build the contact section for the prompt
 */
export function buildContactSection(contact?: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
}): string {
  if (!contact) return '';

  const name = contact.full_name ||
    `${contact.first_name || ''} ${contact.last_name || ''}`.trim() ||
    'N/A';

  return `
Primary Contact:
- Name: ${name}
- Title: ${contact.title || 'N/A'}`;
}

/**
 * Build the content section based on available data
 */
export function buildContentSection(
  transcript?: string,
  summary?: string,
  notes?: string
): string {
  if (transcript && transcript.length > 100) {
    return `
Full Meeting Transcript:
${transcript}`;
  }

  if (summary) {
    return `
Meeting Summary:
${summary}`;
  }

  if (notes) {
    return `
Activity Notes:
${notes}`;
  }

  return '';
}

/**
 * Build the recent activities section
 */
export function buildRecentActivitiesSection(
  activities?: Array<{
    type: string;
    created_at: string;
    notes?: string;
    details?: string;
  }>
): string {
  if (!activities || activities.length === 0) return '';

  const list = activities
    .map((activity, index) => {
      const date = new Date(activity.created_at).toLocaleDateString();
      const details = activity.notes || activity.details || 'No details';
      return `${index + 1}. [${activity.type}] ${date}: ${details}`;
    })
    .join('\n');

  return `
Recent Activity History (last 30 days):
${list}`;
}

/**
 * Build the existing context section for deduplication
 */
export function buildExistingContextSection(existingContext?: {
  suggestions?: Array<{ title: string; action_type: string; status: string }>;
  tasks?: Array<{ title: string; task_type: string; status: string }>;
}): string {
  if (!existingContext) return '';

  const { suggestions, tasks } = existingContext;

  if (!suggestions?.length && !tasks?.length) return '';

  let section = '\n\n**IMPORTANT - EXISTING TASKS AND SUGGESTIONS TO AVOID DUPLICATES:**\n';

  if (suggestions && suggestions.length > 0) {
    section += '\nPreviously Suggested Actions:\n';
    suggestions.forEach((s, i) => {
      section += `${i + 1}. [${s.action_type}] ${s.title} (Status: ${s.status})\n`;
    });
  }

  if (tasks && tasks.length > 0) {
    section += '\nAlready Created Tasks:\n';
    tasks.forEach((t, i) => {
      section += `${i + 1}. [${t.task_type}] ${t.title} (Status: ${t.status})\n`;
    });
  }

  section += '\nDO NOT suggest tasks that are similar to or duplicate the ones listed above. Focus on NEW, DIFFERENT action items.\n';

  return section;
}
