/**
 * Writing Style Analysis Prompts
 *
 * Analyzes user's sent emails to extract their unique writing style
 * for AI personalization.
 *
 * @file supabase/functions/analyze-writing-style/index.ts
 * @model claude-sonnet-4-20250514
 * @temperature 0.5
 * @maxTokens 2048
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// System Prompt
// ============================================================================

export const WRITING_STYLE_SYSTEM_PROMPT = `You are an expert linguistic analyst who extracts writing style patterns from email communications.

Your task is to analyze a collection of sent emails and identify the writer's unique voice and communication style.

Focus on HOW they write, not WHAT they write about:
- Tone and formality level
- Sentence structure and length patterns
- Vocabulary complexity and common phrases
- Greeting and sign-off patterns
- Use of formatting (bullets, paragraphs, etc.)

Look for consistent patterns across all emails to build an accurate style profile.`;

// ============================================================================
// User Prompt Template
// ============================================================================

export const WRITING_STYLE_USER_PROMPT = `Analyze these \${emailCount} sent emails and extract the writer's unique voice and communication style.

IMPORTANT: Focus on HOW they write, not WHAT they write about. Look for consistent patterns across all emails.

EMAILS TO ANALYZE:
\${emailSamples}

Analyze and return a JSON object with this EXACT structure (no additional text):
{
  "name": "2-4 word style name (e.g., 'Direct & Professional', 'Warm Conversational')",
  "tone_description": "2-3 sentences describing the writing style, sentence patterns, and voice characteristics",
  "tone": {
    "formality": <1-5 integer, 1=very casual, 5=very formal>,
    "directness": <1-5 integer, 1=very diplomatic, 5=very direct>,
    "warmth": <1-5 integer, 1=cold/businesslike, 5=very warm/friendly>
  },
  "structure": {
    "avg_sentence_length": <number of words>,
    "preferred_length": "brief" | "moderate" | "detailed",
    "uses_bullets": <boolean>
  },
  "vocabulary": {
    "complexity": "simple" | "professional" | "technical",
    "common_phrases": ["phrase1", "phrase2", "phrase3"],
    "industry_terms": ["term1", "term2"]
  },
  "greetings_signoffs": {
    "greetings": ["greeting1", "greeting2"],
    "signoffs": ["signoff1", "signoff2"]
  },
  "example_excerpts": ["1-2 sentence excerpt that exemplifies the style", "another example", "third example"],
  "analysis_confidence": <0.0-1.0 float>
}

Return ONLY valid JSON, no markdown formatting or explanation.`;

// ============================================================================
// Variables
// ============================================================================

export const WRITING_STYLE_VARIABLES: PromptVariable[] = [
  {
    name: 'emailCount',
    description: 'Number of emails being analyzed',
    type: 'number',
    required: true,
    example: '15',
    source: 'computed',
  },
  {
    name: 'emailSamples',
    description: 'Formatted email samples for analysis',
    type: 'string',
    required: true,
    example: '--- EMAIL 1 ---\\nSubject: Re: Proposal\\nBody: Hi John, Thanks for...',
    source: 'gmail_api',
  },
];

// ============================================================================
// Response Schema
// ============================================================================

export const WRITING_STYLE_RESPONSE_SCHEMA = `{
  "type": "object",
  "required": ["name", "tone_description", "tone", "structure", "vocabulary", "greetings_signoffs", "example_excerpts", "analysis_confidence"],
  "properties": {
    "name": {
      "type": "string",
      "description": "2-4 word style name"
    },
    "tone_description": {
      "type": "string",
      "description": "2-3 sentences describing the writing style"
    },
    "tone": {
      "type": "object",
      "required": ["formality", "directness", "warmth"],
      "properties": {
        "formality": { "type": "integer", "minimum": 1, "maximum": 5 },
        "directness": { "type": "integer", "minimum": 1, "maximum": 5 },
        "warmth": { "type": "integer", "minimum": 1, "maximum": 5 }
      }
    },
    "structure": {
      "type": "object",
      "required": ["avg_sentence_length", "preferred_length", "uses_bullets"],
      "properties": {
        "avg_sentence_length": { "type": "number" },
        "preferred_length": { "type": "string", "enum": ["brief", "moderate", "detailed"] },
        "uses_bullets": { "type": "boolean" }
      }
    },
    "vocabulary": {
      "type": "object",
      "required": ["complexity", "common_phrases", "industry_terms"],
      "properties": {
        "complexity": { "type": "string", "enum": ["simple", "professional", "technical"] },
        "common_phrases": { "type": "array", "items": { "type": "string" } },
        "industry_terms": { "type": "array", "items": { "type": "string" } }
      }
    },
    "greetings_signoffs": {
      "type": "object",
      "required": ["greetings", "signoffs"],
      "properties": {
        "greetings": { "type": "array", "items": { "type": "string" } },
        "signoffs": { "type": "array", "items": { "type": "string" } }
      }
    },
    "example_excerpts": {
      "type": "array",
      "items": { "type": "string" }
    },
    "analysis_confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    }
  }
}`;

// ============================================================================
// Template Export
// ============================================================================

export const writingStyleTemplate: PromptTemplate = {
  id: 'writing-style',
  name: 'Writing Style Analysis',
  description: 'Analyzes sent emails to extract unique writing style for AI personalization.',
  featureKey: 'writing_style',
  systemPrompt: WRITING_STYLE_SYSTEM_PROMPT,
  userPrompt: WRITING_STYLE_USER_PROMPT,
  variables: WRITING_STYLE_VARIABLES,
  responseFormat: 'json',
  responseSchema: WRITING_STYLE_RESPONSE_SCHEMA,
};

// ============================================================================
// Response Types
// ============================================================================

export interface ToneProfile {
  formality: number;
  directness: number;
  warmth: number;
}

export interface StructureProfile {
  avg_sentence_length: number;
  preferred_length: 'brief' | 'moderate' | 'detailed';
  uses_bullets: boolean;
}

export interface VocabularyProfile {
  complexity: 'simple' | 'professional' | 'technical';
  common_phrases: string[];
  industry_terms: string[];
}

export interface GreetingsSignoffs {
  greetings: string[];
  signoffs: string[];
}

export interface WritingStyleResponse {
  name: string;
  tone_description: string;
  tone: ToneProfile;
  structure: StructureProfile;
  vocabulary: VocabularyProfile;
  greetings_signoffs: GreetingsSignoffs;
  example_excerpts: string[];
  analysis_confidence: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format emails for the analysis prompt
 */
export function formatEmailsForAnalysis(
  emails: Array<{ subject: string; body: string }>
): string {
  return emails
    .slice(0, 15) // Limit to 15 emails
    .map((email, i) => `
--- EMAIL ${i + 1} ---
Subject: ${email.subject}
Body:
${email.body.substring(0, 1500)}`)
    .join('\n');
}

/**
 * Parse and validate the writing style response
 */
export function parseWritingStyleResponse(content: string): WritingStyleResponse {
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON');
  }

  const style = JSON.parse(jsonMatch[0]) as WritingStyleResponse;

  // Validate required fields
  if (!style.name || !style.tone_description) {
    throw new Error('Invalid style response: missing required fields');
  }

  return style;
}

/**
 * Generate a style description from the analysis
 */
export function generateStyleSummary(style: WritingStyleResponse): string {
  const formalityDesc = style.tone.formality <= 2 ? 'casual' :
    style.tone.formality >= 4 ? 'formal' : 'balanced';

  const directnessDesc = style.tone.directness <= 2 ? 'diplomatic' :
    style.tone.directness >= 4 ? 'direct' : 'moderate';

  const warmthDesc = style.tone.warmth <= 2 ? 'businesslike' :
    style.tone.warmth >= 4 ? 'warm and friendly' : 'professional';

  return `${style.name}: A ${formalityDesc}, ${directnessDesc} style that is ${warmthDesc}. ${style.tone_description}`;
}

/**
 * Calculate average sentence length from text
 */
export function calculateAvgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce((sum, sentence) => {
    return sum + sentence.trim().split(/\s+/).length;
  }, 0);

  return Math.round(totalWords / sentences.length);
}

/**
 * Extract common greetings from emails
 */
export function extractGreetings(emails: Array<{ body: string }>): string[] {
  const greetingPatterns = [
    /^(hi|hello|hey|dear|good morning|good afternoon|good evening)\s*[,!]?\s*\w*/i,
  ];

  const greetings = new Set<string>();

  for (const email of emails) {
    const firstLine = email.body.split('\n')[0]?.trim() || '';
    for (const pattern of greetingPatterns) {
      const match = firstLine.match(pattern);
      if (match) {
        greetings.add(match[0].trim());
      }
    }
  }

  return Array.from(greetings).slice(0, 5);
}

/**
 * Extract common sign-offs from emails
 */
export function extractSignoffs(emails: Array<{ body: string }>): string[] {
  const signoffPatterns = [
    /(best|regards|thanks|thank you|cheers|sincerely|warm regards|best regards|kind regards|talk soon|looking forward)[,!]?\s*$/i,
  ];

  const signoffs = new Set<string>();

  for (const email of emails) {
    const lines = email.body.split('\n');
    const lastLines = lines.slice(-5).join('\n');

    for (const pattern of signoffPatterns) {
      const match = lastLines.match(pattern);
      if (match) {
        signoffs.add(match[0].trim().replace(/,+$/, ''));
      }
    }
  }

  return Array.from(signoffs).slice(0, 5);
}
