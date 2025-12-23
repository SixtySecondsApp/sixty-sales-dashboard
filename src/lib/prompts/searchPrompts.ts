/**
 * Search & Intelligence Prompts
 *
 * Prompts for search query parsing and intelligence features.
 *
 * @model claude-sonnet-4-20250514 (configurable)
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// Search Query Parse Prompt
// ============================================================================

export const SEARCH_QUERY_PARSE_SYSTEM_PROMPT = `You are a search query parser that extracts semantic intent and structured filters from natural language queries.

Your task is to:
1. Extract the semantic meaning of what the user is searching for
2. Identify any structured filters (dates, companies, contacts, etc.)
3. Return a clean query for semantic search plus any applicable filters

Be precise and conservative - only extract filters you're confident about.`;

export const SEARCH_QUERY_PARSE_USER_PROMPT = `Parse this search query into semantic and structured components.

TODAY'S DATE: \${today}

QUERY: "\${query}"

Return ONLY valid JSON in this exact format:
{
  "semantic_query": "The core search intent without filter keywords",
  "structured_filters": {
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "company_name": "Acme Corp",
    "contact_name": "John Smith",
    "sentiment": "positive",
    "has_action_items": true
  }
}

Filter extraction rules:
- date_range: Parse phrases like "last week", "this month", "in January", "past 30 days"
  - Use TODAY'S DATE as the reference point
  - Return null if no date mentioned
- company_name: Extract company names mentioned (e.g., "meetings with Acme")
  - Return null if no company mentioned
- contact_name: Extract person names mentioned (e.g., "calls with John")
  - Return null if no contact mentioned
- sentiment: Extract if user asks for "positive", "negative", or "neutral" meetings
  - Return null if no sentiment mentioned
- has_action_items: Set to true if user asks for meetings "with action items" or "with tasks"
  - Return null if not mentioned

Examples:
- "meetings about pricing last week" → semantic: "meetings about pricing", date_range: last 7 days
- "calls with John from Acme" → semantic: "calls", company_name: "Acme", contact_name: "John"
- "positive meetings with action items" → semantic: "meetings", sentiment: "positive", has_action_items: true

IMPORTANT:
- semantic_query should be cleaned of filter keywords
- Use null for any filter not clearly specified
- Return ONLY the JSON, no other text`;

export const SEARCH_QUERY_PARSE_VARIABLES: PromptVariable[] = [
  {
    name: 'today',
    description: 'Current date for relative date calculations',
    type: 'string',
    required: true,
    example: '2025-01-22',
    source: 'request',
  },
  {
    name: 'query',
    description: 'The natural language search query',
    type: 'string',
    required: true,
    example: 'meetings about pricing last week',
    source: 'request',
  },
];

export const searchQueryParseTemplate: PromptTemplate = {
  id: 'search-query-parse',
  name: 'Search Query Parser',
  description: 'Parses natural language search queries into semantic queries and structured filters.',
  featureKey: 'search_query_parse',
  systemPrompt: SEARCH_QUERY_PARSE_SYSTEM_PROMPT,
  userPrompt: SEARCH_QUERY_PARSE_USER_PROMPT,
  variables: SEARCH_QUERY_PARSE_VARIABLES,
  responseFormat: 'json',
};

// ============================================================================
// Response Types
// ============================================================================

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface StructuredFilters {
  date_range: DateRange | null;
  company_name: string | null;
  contact_name: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  has_action_items: boolean | null;
}

export interface ParsedSearchQuery {
  semantic_query: string;
  structured_filters: StructuredFilters;
}
