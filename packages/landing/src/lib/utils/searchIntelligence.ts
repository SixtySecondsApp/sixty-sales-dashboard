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

  // Date range - enhanced parsing
  const datePatterns = [
    { pattern: /\b(today)\b/i, range: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { from: today.toISOString(), to: new Date().toISOString() };
    }},
    { pattern: /\b(yesterday)\b/i, range: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { from: yesterday.toISOString(), to: end.toISOString() };
    }},
    { pattern: /\b(this week)\b/i, range: () => {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return { from: startOfWeek.toISOString() };
    }},
    { pattern: /\b(this month)\b/i, range: () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: startOfMonth.toISOString() };
    }},
    { pattern: /\b(last week)\b/i, range: () => {
      const today = new Date();
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return { from: lastWeekStart.toISOString(), to: lastWeekEnd.toISOString() };
    }},
    { pattern: /\b(last month)\b/i, range: () => {
      const today = new Date();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { from: lastMonthStart.toISOString(), to: lastMonthEnd.toISOString() };
    }},
    { pattern: /\b(in|from|after)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, range: (match: RegExpMatchArray) => {
      // Parse date from match
      return { from: match[2] };
    }},
    { pattern: /\b(before|until)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, range: (match: RegExpMatchArray) => {
      return { to: match[2] };
    }}
  ];
  
  for (const datePattern of datePatterns) {
    const match = lowerQuery.match(datePattern.pattern);
    if (match) {
      const range = typeof datePattern.range === 'function' 
        ? datePattern.range(match)
        : datePattern.range(match);
      result.filters.dateRange = { ...result.filters.dateRange, ...range };
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

  // Extract actions - more comprehensive
  const actionPatterns = [
    { pattern: /\b(send|write|draft|compose)\s+(an\s+)?email\b/i, action: 'send email' },
    { pattern: /\bemail\s+(to|for)\b/i, action: 'send email' },
    { pattern: /\b(call|phone|ring)\b/i, action: 'call' },
    { pattern: /\b(schedule|book|set up)\s+(a\s+)?meeting\b/i, action: 'schedule meeting' },
    { pattern: /\b(create|add|new)\s+(a\s+)?task\b/i, action: 'create task' },
    { pattern: /\b(follow up|follow-up)\b/i, action: 'follow up' },
    { pattern: /\b(update|modify|change)\b/i, action: 'update' },
    { pattern: /\b(mark|set)\s+(as\s+)?(complete|done|finished)\b/i, action: 'complete' },
    { pattern: /\b(close|finish)\s+(deal|deal)\b/i, action: 'close deal' }
  ];
  
  for (const { pattern, action } of actionPatterns) {
    if (pattern.test(lowerQuery)) {
      if (!result.actions.includes(action)) {
        result.actions.push(action);
      }
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
  const queryWords = query.trim().split(/\s+/);

  // If query is very short, suggest common searches
  if (query.length < 3) {
    return [
      'Find meetings with...',
      'Show at-risk deals',
      'Contacts from this week',
      'Deals over $50k',
      'My top priorities',
      'Recent activity',
      'High-value opportunities'
    ];
  }

  // Extract potential name/entity from query
  const potentialName = queryWords.length > 1 ? queryWords.slice(-2).join(' ') : query;

  // Suggest entity-specific queries with context
  if (entities.includes('deal') || entities.length === 0) {
    suggestions.push(`Deals with ${potentialName}`);
    suggestions.push(`At-risk deals with ${potentialName}`);
    suggestions.push(`Deals over $50k`);
    if (!lowerQuery.includes('this week') && !lowerQuery.includes('this month')) {
      suggestions.push(`Deals from this week`);
    }
  }

  if (entities.includes('contact') || entities.length === 0) {
    suggestions.push(`Contact ${potentialName}`);
    suggestions.push(`Meetings with ${potentialName}`);
    suggestions.push(`Deals with ${potentialName}`);
    if (!lowerQuery.includes('this week')) {
      suggestions.push(`Contacts from this week`);
    }
  }

  if (entities.includes('meeting') || entities.length === 0) {
    suggestions.push(`Meetings with ${potentialName}`);
    suggestions.push(`Recent meetings with ${potentialName}`);
    if (!lowerQuery.includes('this week')) {
      suggestions.push(`Meetings from this week`);
    }
  }

  if (entities.includes('company') || entities.length === 0) {
    suggestions.push(`Company ${potentialName}`);
    suggestions.push(`Contacts at ${potentialName}`);
  }

  // Suggest actions if not already present
  if (!lowerQuery.includes('send') && !lowerQuery.includes('email') && !lowerQuery.includes('draft')) {
    suggestions.push(`Send email to ${potentialName}`);
  }

  if (!lowerQuery.includes('schedule') && !lowerQuery.includes('meeting') && !lowerQuery.includes('book')) {
    suggestions.push(`Schedule meeting with ${potentialName}`);
  }

  // Suggest analytical queries
  if (!lowerQuery.includes('show') && !lowerQuery.includes('find') && !lowerQuery.includes('list')) {
    suggestions.push(`Show at-risk deals`);
    suggestions.push(`My top priorities`);
  }

  // Remove duplicates and limit
  const uniqueSuggestions = Array.from(new Set(suggestions));
  return uniqueSuggestions.slice(0, 6);
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

  // Boost recent items (stronger for very recent)
  if (item.created_at || item.meeting_start) {
    const date = new Date(item.created_at || item.meeting_start);
    const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) {
      score += 0.3; // Strong boost for items from last week
    } else if (daysAgo < 30) {
      score += 0.2; // Moderate boost for items from last month
    } else {
      score += Math.max(0, (90 - daysAgo) / 90) * 0.1; // Gradual decay
    }
  }

  // Boost high-value deals
  if (item.value && query.entities.includes('deal')) {
    const valueBoost = Math.min(item.value / 100000, 0.3); // Cap at 30% boost
    score += valueBoost;
    
    // Extra boost for deals matching value filters
    if (query.filters.valueRange) {
      if (query.filters.valueRange.min && item.value >= query.filters.valueRange.min) {
        score += 0.2;
      }
      if (query.filters.valueRange.max && item.value <= query.filters.valueRange.max) {
        score += 0.2;
      }
    }
  }

  // Boost items matching filters
  if (query.filters.status && item.status === query.filters.status) {
    score += 0.3;
  }

  if (query.filters.stage && (item.stage === query.filters.stage || item.deal_stages?.name === query.filters.stage)) {
    score += 0.3;
  }

  // Boost primary contacts
  if (item.is_primary || item.primary_contact_id) {
    score += 0.15;
  }

  // Boost items matching contact/company name filters
  if (query.filters.contactName) {
    const contactName = query.filters.contactName.toLowerCase();
    const itemName = `${item.first_name || ''} ${item.last_name || ''}`.trim().toLowerCase();
    const itemEmail = item.email?.toLowerCase() || '';
    if (itemName.includes(contactName) || itemEmail.includes(contactName)) {
      score += 0.25;
    }
  }

  if (query.filters.companyName) {
    const companyName = query.filters.companyName.toLowerCase();
    const itemName = item.name?.toLowerCase() || item.company?.toLowerCase() || '';
    if (itemName.includes(companyName)) {
      score += 0.25;
    }
  }

  // Boost exact matches in title/name
  const queryLower = query.originalQuery.toLowerCase();
  if (item.name?.toLowerCase().includes(queryLower) || 
      item.title?.toLowerCase().includes(queryLower) ||
      `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase().includes(queryLower)) {
    score += 0.15;
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

