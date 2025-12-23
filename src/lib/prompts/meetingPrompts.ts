/**
 * Meeting Intelligence Prompts
 *
 * Additional prompts for meeting analysis beyond transcript analysis:
 * - condense_summary: Condense meeting summaries into brief one-liners
 * - meeting_qa: Answer questions about meeting content
 * - content_topics: Extract marketable discussion topics
 *
 * @model claude-haiku-4-5-20251001 (configurable)
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// Condense Summary Prompt
// ============================================================================

export const CONDENSE_SUMMARY_SYSTEM_PROMPT = `You are a concise summarizer who creates brief, impactful meeting summaries.

Your task is to distill meeting summaries into two extremely brief one-liners:
1. What the meeting was about (the main topic/purpose)
2. What the next steps are (key action items)

Be direct and specific. Avoid generic language.`;

export const CONDENSE_SUMMARY_USER_PROMPT = `Condense this meeting summary into two brief one-liners (max 15 words each).

MEETING: \${meetingTitle}

SUMMARY:
\${summary}

Return ONLY valid JSON in this exact format:
{
  "meeting_about": "Brief description of what the meeting covered",
  "next_steps": "Brief description of key next steps"
}

IMPORTANT:
- Each line must be 15 words or fewer
- Be specific, not generic
- Return ONLY the JSON, no other text`;

export const CONDENSE_SUMMARY_VARIABLES: PromptVariable[] = [
  {
    name: 'meetingTitle',
    description: 'Title of the meeting',
    type: 'string',
    required: true,
    example: 'Q4 Strategy Review',
    source: 'meetings',
  },
  {
    name: 'summary',
    description: 'The full meeting summary to condense',
    type: 'string',
    required: true,
    example: '[Full summary content...]',
    source: 'meetings',
  },
];

export const condenseSummaryTemplate: PromptTemplate = {
  id: 'condense-summary',
  name: 'Summary Condensing',
  description: 'Condenses meeting summaries into brief, impactful one-liners.',
  featureKey: 'condense_summary',
  systemPrompt: CONDENSE_SUMMARY_SYSTEM_PROMPT,
  userPrompt: CONDENSE_SUMMARY_USER_PROMPT,
  variables: CONDENSE_SUMMARY_VARIABLES,
  responseFormat: 'json',
};

// ============================================================================
// Meeting Q&A Prompt
// ============================================================================

export const MEETING_QA_SYSTEM_PROMPT = `You are a helpful assistant that answers questions about meeting transcripts.

Your task is to:
1. Find relevant information in the transcript
2. Provide specific, accurate answers
3. Reference the transcript when possible
4. Be honest when information is not available

Be specific and reference actual content from the transcript.`;

export const MEETING_QA_USER_PROMPT = `Answer this question about the meeting based on the transcript.

MEETING: \${meetingTitle}
DATE: \${meetingDate}

TRANSCRIPT:
\${transcript}

QUESTION: \${question}

Provide a clear, specific answer based on the transcript content. If the information is not available in the transcript, say so clearly.`;

export const MEETING_QA_VARIABLES: PromptVariable[] = [
  {
    name: 'meetingTitle',
    description: 'Title of the meeting',
    type: 'string',
    required: true,
    example: 'Sales Kickoff Q1',
    source: 'meetings',
  },
  {
    name: 'meetingDate',
    description: 'Date of the meeting',
    type: 'string',
    required: true,
    example: '2025-01-15',
    source: 'meetings',
  },
  {
    name: 'transcript',
    description: 'Full meeting transcript',
    type: 'string',
    required: true,
    example: '[Full transcript content...]',
    source: 'meetings',
  },
  {
    name: 'question',
    description: 'The question to answer about the meeting',
    type: 'string',
    required: true,
    example: 'What pricing was discussed?',
    source: 'request',
  },
];

export const meetingQATemplate: PromptTemplate = {
  id: 'meeting-qa',
  name: 'Meeting Q&A',
  description: 'Answers questions about meeting content based on transcripts.',
  featureKey: 'meeting_qa',
  systemPrompt: MEETING_QA_SYSTEM_PROMPT,
  userPrompt: MEETING_QA_USER_PROMPT,
  variables: MEETING_QA_VARIABLES,
  responseFormat: 'text',
};

// ============================================================================
// Content Topics Prompt
// ============================================================================

export const CONTENT_TOPICS_SYSTEM_PROMPT = `You are a content strategist who identifies marketable discussion topics from meeting transcripts.

Your task is to:
1. Find interesting, valuable discussion points
2. Identify topics that could be repurposed for marketing content
3. Extract specific moments with timestamps when available
4. Focus on insights, quotes, and unique perspectives

Look for content that would resonate with an audience.`;

export const CONTENT_TOPICS_USER_PROMPT = `Extract 5-10 marketable discussion topics from this meeting transcript.

MEETING: \${meetingTitle}
DATE: \${meetingDate}

TRANSCRIPT:
\${transcript}

Return ONLY valid JSON as an array of topics:
[
  {
    "title": "Brief, catchy title for the topic",
    "description": "2-3 sentence description of what was discussed",
    "timestamp_seconds": 120,
    "fathom_url": null
  }
]

For each topic:
- title: Short, engaging title (suitable for a blog post or social media)
- description: Brief explanation of what was discussed and why it's interesting
- timestamp_seconds: Approximate timestamp in seconds (estimate if not available, use null if completely unknown)
- fathom_url: Leave as null (will be populated by the system)

Focus on:
- Unique insights or perspectives
- Quotable moments
- Problem/solution discussions
- Industry trends mentioned
- Customer pain points discussed
- Success stories or case studies
- Best practices shared

IMPORTANT: Return ONLY the JSON array, no other text.`;

export const CONTENT_TOPICS_VARIABLES: PromptVariable[] = [
  {
    name: 'meetingTitle',
    description: 'Title of the meeting',
    type: 'string',
    required: true,
    example: 'Customer Discovery Call',
    source: 'meetings',
  },
  {
    name: 'meetingDate',
    description: 'Date of the meeting',
    type: 'string',
    required: true,
    example: '2025-01-20',
    source: 'meetings',
  },
  {
    name: 'transcript',
    description: 'Full meeting transcript',
    type: 'string',
    required: true,
    example: '[Full transcript content...]',
    source: 'meetings',
  },
];

export const contentTopicsTemplate: PromptTemplate = {
  id: 'content-topics',
  name: 'Content Topic Extraction',
  description: 'Extracts marketable discussion topics from meeting transcripts for content creation.',
  featureKey: 'content_topics',
  systemPrompt: CONTENT_TOPICS_SYSTEM_PROMPT,
  userPrompt: CONTENT_TOPICS_USER_PROMPT,
  variables: CONTENT_TOPICS_VARIABLES,
  responseFormat: 'json',
};

// ============================================================================
// Response Types
// ============================================================================

export interface CondensedSummary {
  meeting_about: string;
  next_steps: string;
}

export interface ContentTopic {
  title: string;
  description: string;
  timestamp_seconds: number | null;
  fathom_url: string | null;
}
