/**
 * Search Intelligence Utilities
 * Advanced natural language understanding and intent detection for agent-like search
 */

export type SearchIntent = 
  | 'find' 
  | 'create' 
  | 'analyze' 
  | 'action' 
  | 'relationship' 
  | 'filter' 
  | 'general';

export type EntityType = 'contact' | 'company' | 'deal' | 'meeting' | 'task' | 'activity';

export interface ParsedQuery {
  intent: SearchIntent;
  entities: EntityType[];
  filters: {
    status?: string;
    stage?: string;
    dateRange?: { from?: string; to?: string };
    valueRange?: { min?: number; max?: number };
    contactName?: string;
    companyName?: string;
  };
  actions: string[];
  confidence: number;
  originalQuery: string;
}

/**
 * Advanced query parser with intent detection
 */
export function parseQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase().trim();
  const originalQuery = query;
  
  // Initialize result
  const result: ParsedQuery = {
    intent: 'find',
    entities: [],
    filters: {},
    actions: [],
    confidence: 0.5,
    originalQuery
  };

  // Intent detection patterns
  const intentPatterns = {
    create: [
      /^(create|add|new|make|start)\s+/i,
      /\b(create|add|new|make|start)\s+(a|an|the)?\s*(contact|company|deal|meeting|task)/i
    ],
    analyze: [
      /\b(analyze|analyze|show|summarize|report|stats|statistics|metrics|performance|health|status)\b/i,
      /\b(how many|how much|count|total|average|trend)\b/i,
      /\b(at risk|needs attention|stuck|overdue)\b/i
    ],
    action: [
      /\b(send|email|call|schedule|book|set|update|mark|complete|close)\b/i,
      /\b(follow up|follow-up|remind|notify)\b/i
    ],
    relationship: [
      /\b(with|related to|connected|linked|associated)\b/i,
      /\b(show|find|get).*?(contacts|companies|deals|meetings).*?(with|for|related)\b/i
    ],
    filter: [
      /\b(in|from|to|between|after|before|since|until)\b/i,
      /\b(over|under|above|below|more than|less than)\b/i,
      /\b(status|stage|type|priority)\s*(is|equals|=)\b/i
    ]
  };

  // Detect intent
  let maxScore = 0;
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    const score = patterns.reduce((acc, pattern) => {
      return acc + (pattern.test(lowerQuery) ? 1 : 0);
    }, 0);
    if (score > maxScore) {
      maxScore = score;
      result.intent = intent as SearchIntent;
    }
  }

  // Entity detection
  const entityKeywords: Record<EntityType, string[]> = {
    contact: ['contact', 'person', 'people', 'individual', 'email'],
    company: ['company', 'companies', 'organization', 'org', 'business', 'firm'],
    deal: ['deal', 'deals', 'opportunity', 'opportunities', 'sale', 'sales', 'pipeline'],
    meeting: ['meeting', 'meetings', 'call', 'calls', 'appointment', 'calendar'],
    task: ['task', 'tasks', 'todo', 'action item', 'action items'],
    activity: ['activity', 'activities', 'interaction', 'interactions', 'engagement']
  };

  for (const [entity, keywords] of Object.entries(entityKeywords)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.entities.push(entity as EntityType);
    }
  }

  // If no entities detected, infer from context
  if (result.entities.length === 0) {
    // Default to all entities for general search
    result.entities = ['contact', 'company', 'deal', 'meeting'];
  }

  // Extract filters
  // Status/Stage filters
  const statusMatch = lowerQuery.match(/\b(status|stage|type)\s*(is|equals|=)?\s*(\w+)/i);
  if (statusMatch) {
    result.filters.status = statusMatch[3];
  }

  // Date range
  const datePatterns = [
    /\b(today|yesterday|this week|this month|this quarter|this year)\b/i,
    /\b(last week|last month|last quarter|last year)\b/i,
    /\b(in|from|after)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /\b(before|after|since|until)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      // Parse date range (simplified)
      if (match[0].includes('this week')) {
        result.filters.dateRange = { from: 'this-week' };
      } else if (match[0].includes('this month')) {
        result.filters.dateRange = { from: 'this-month' };
      }
      break;
    }
  }

  // Value range
  const valueMatch = lowerQuery.match(/\b(over|above|more than|greater than)\s*\$?(\d+[kKmMbB]?)/i);
  if (valueMatch) {
    const value = parseValue(valueMatch[2]);
    result.filters.valueRange = { min: value };
  }

  const valueMatchMax = lowerQuery.match(/\b(under|below|less than|under)\s*\$?(\d+[kKmMbB]?)/i);
  if (valueMatchMax) {
    const value = parseValue(valueMatchMax[2]);
    result.filters.valueRange = { ...result.filters.valueRange, max: value };
  }

  // Contact/Company name extraction
  const withMatch = lowerQuery.match(/\b(with|for|related to)\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
  if (withMatch) {
    const name = withMatch[2].trim();
    if (name.length > 1) {
      // Determine if it's a contact or company name
      if (result.entities.includes('meeting')) {
        result.filters.contactName = name;
      } else {
        // Try to infer - if it's capitalized, likely a company
        if (name.split(' ').every(word => word[0] === word[0]?.toUpperCase())) {
          result.filters.companyName = name;
        } else {
          result.filters.contactName = name;
        }
      }
    }
  }

  // Extract actions
  const actionKeywords = [
    'send email', 'email', 'call', 'schedule', 'book', 'set reminder',
    'follow up', 'update', 'mark', 'complete', 'close', 'create task'
  ];
  
  for (const action of actionKeywords) {
    if (lowerQuery.includes(action)) {
      result.actions.push(action);
    }
  }

  // Calculate confidence
  result.confidence = Math.min(
    0.5 + (maxScore * 0.15) + (result.entities.length * 0.1) + (Object.keys(result.filters).length * 0.1),
    1.0
  );

  return result;
}

/**
 * Parse value string (e.g., "50k" -> 50000)
 */
function parseValue(valueStr: string): number {
  const num = parseFloat(valueStr.replace(/[kKmMbB]/g, ''));
  const multiplier = valueStr.toLowerCase().includes('k') ? 1000 :
                     valueStr.toLowerCase().includes('m') ? 1000000 :
                     valueStr.toLowerCase().includes('b') ? 1000000000 : 1;
  return num * multiplier;
}

/**
 * Generate smart query suggestions based on current query
 */
export function generateQuerySuggestions(query: string, entities: EntityType[]): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // If query is very short, suggest common searches
  if (query.length < 3) {
    return [
      'Find meetings with...',
      'Show at-risk deals',
      'Contacts from this week',
      'Deals over $50k',
      'My top priorities'
    ];
  }

  // Suggest entity-specific queries
  if (entities.includes('deal')) {
    suggestions.push(`Deals with ${query}`);
    suggestions.push(`At-risk deals with ${query}`);
    suggestions.push(`Deals over $50k with ${query}`);
  }

  if (entities.includes('contact')) {
    suggestions.push(`Contact ${query}`);
    suggestions.push(`Meetings with ${query}`);
    suggestions.push(`Deals with ${query}`);
  }

  if (entities.includes('meeting')) {
    suggestions.push(`Meetings with ${query}`);
    suggestions.push(`Recent meetings with ${query}`);
  }

  // Suggest actions
  if (!lowerQuery.includes('send') && !lowerQuery.includes('email')) {
    suggestions.push(`Send email to ${query}`);
  }

  if (!lowerQuery.includes('schedule') && !lowerQuery.includes('meeting')) {
    suggestions.push(`Schedule meeting with ${query}`);
  }

  return suggestions.slice(0, 5);
}

/**
 * Calculate relevance score for search results
 */
export function calculateRelevanceScore(
  item: any,
  query: ParsedQuery,
  matchScore: number
): number {
  let score = 1 - matchScore; // Fuse.js returns 0-1, lower is better

  // Boost recent items
  if (item.created_at || item.meeting_start) {
    const date = new Date(item.created_at || item.meeting_start);
    const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (30 - daysAgo) / 30) * 0.2; // Boost items from last 30 days
  }

  // Boost high-value deals
  if (item.value && query.entities.includes('deal')) {
    const valueBoost = Math.min(item.value / 100000, 0.3); // Cap at 30% boost
    score += valueBoost;
  }

  // Boost items matching filters
  if (query.filters.status && item.status === query.filters.status) {
    score += 0.3;
  }

  if (query.filters.stage && item.stage === query.filters.stage) {
    score += 0.3;
  }

  // Boost primary contacts
  if (item.is_primary || item.primary_contact_id) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Extract quick actions from query
 */
export function extractQuickActions(query: ParsedQuery, item: any): Array<{
  label: string;
  action: string;
  icon: string;
}> {
  const actions: Array<{ label: string; action: string; icon: string }> = [];

  if (query.intent === 'action' || query.actions.length > 0) {
    if (query.actions.some(a => a.includes('email'))) {
      actions.push({
        label: 'Send Email',
        action: 'send-email',
        icon: 'Mail'
      });
    }

    if (query.actions.some(a => a.includes('call'))) {
      actions.push({
        label: 'Call',
        action: 'call',
        icon: 'Phone'
      });
    }

    if (query.actions.some(a => a.includes('meeting') || a.includes('schedule'))) {
      actions.push({
        label: 'Schedule Meeting',
        action: 'schedule-meeting',
        icon: 'Calendar'
      });
    }
  } else {
    // Default actions based on entity type
    if (item.type === 'contact') {
      actions.push(
        { label: 'Send Email', action: 'send-email', icon: 'Mail' },
        { label: 'Schedule Meeting', action: 'schedule-meeting', icon: 'Calendar' },
        { label: 'View Details', action: 'view', icon: 'User' }
      );
    } else if (item.type === 'deal') {
      actions.push(
        { label: 'View Deal', action: 'view', icon: 'DollarSign' },
        { label: 'Send Update', action: 'send-email', icon: 'Mail' }
      );
    } else if (item.type === 'company') {
      actions.push(
        { label: 'View Company', action: 'view', icon: 'Building2' },
        { label: 'View Contacts', action: 'view-contacts', icon: 'Users' }
      );
    } else if (item.type === 'meeting') {
      actions.push(
        { label: 'View Meeting', action: 'view', icon: 'Video' },
        { label: 'Create Follow-up', action: 'create-task', icon: 'CheckSquare' }
      );
    }
  }

  return actions;
}

