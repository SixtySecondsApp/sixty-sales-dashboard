/**
 * Type definitions for AI Copilot, Contact Record, and Smart Search features
 */

// ============================================================================
// Copilot Types
// ============================================================================

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recommendations?: Recommendation[];
  toolCall?: ToolCall;
  structuredResponse?: CopilotResponse; // New structured response format
}

export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  actions: Action[];
  tags: Tag[];
  dealId?: string;
  contactId?: string;
  href?: string;
  metadata?: Record<string, any>;
}

export interface Action {
  id: string;
  label: string;
  type: 'draft_email' | 'schedule_call' | 'view_brief' | 'view_deal' | 'view_contact' | 'custom';
  variant: 'primary' | 'secondary';
  callback?: () => void;
  href?: string;
  contactId?: string;
  dealId?: string;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface CopilotContextType {
  messages: CopilotMessage[];
  isLoading: boolean;
  sendMessage: (message: string, context?: CopilotContextPayload['context']) => Promise<void>;
  context: CopilotContextPayload['context'];
  setContext: (newContext: Partial<CopilotContextPayload['context']>) => void;
  openCopilot?: (query?: string) => void;
}

export interface CopilotContextPayload {
  message: string;
  conversationId?: string;
  context: {
    userId: string;
    currentView?: 'dashboard' | 'contact' | 'pipeline';
    contactId?: string;
    dealIds?: string[];
  };
}

export interface CopilotResponsePayload {
  response: {
    type: 'text' | 'recommendations' | 'action_required';
    content: string;
    recommendations?: Recommendation[];
  };
  conversationId: string;
  timestamp: string;
}

// ============================================================================
// Contact Record Types
// ============================================================================

export interface ContactRecordData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  title?: string;
  company?: string;
  companyId?: string;
  location?: string;
  avatar?: string;
  tags?: string[];
  status: 'active' | 'inactive';
  dealHealth: DealHealth;
  stats: ContactStats;
  lastMeeting?: MeetingSummary;
  recentActivity: Activity[];
  aiInsights: AIInsight[];
  actionItems: ActionItem[];
}

export interface DealHealth {
  score: number;
  metrics: {
    engagement: { value: number; label: string };
    momentum: { value: number; label: string };
    responseTime: { value: number; label: string };
  };
}

export interface ContactStats {
  totalMeetings: number;
  emailsSent: number;
  avgResponseTime: string;
  dealValue: number;
  closeProbability: number;
}

export interface MeetingSummary {
  id: string;
  date: Date;
  duration: number;
  discussionPoints: string[];
  actionItems: ActionItem[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  transcriptUrl?: string;
  recordingUrl?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  assigneeId?: string;
  dueDate?: Date;
  meetingId?: string;
}

export interface Activity {
  id: string;
  type: 'email' | 'meeting' | 'reply' | 'linkedin' | 'call' | 'task' | 'note';
  title: string;
  timestamp: string;
  metadata?: {
    dealId?: string;
    companyId?: string;
    [key: string]: any;
  };
}

export interface AIInsight {
  id: string;
  type: 'engagement' | 'risk' | 'opportunity' | 'custom';
  content: string;
  priority: 'low' | 'medium' | 'high';
  suggestedActions?: string[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

// ============================================================================
// Smart Search Types
// ============================================================================

export interface SearchResult {
  type: 'contact' | 'deal' | 'meeting' | 'action' | 'copilot_query';
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  icon?: string;
  action: () => void;
  shortcut?: string;
}


// ============================================================================
// Tool Calling Types
// ============================================================================

export type ToolState = 
  | 'initiating'      // Starting the request
  | 'fetching'        // Retrieving data
  | 'processing'      // AI analyzing
  | 'completing'      // Finalizing
  | 'complete';       // Done

export type ToolType = 
  | 'pipeline_data'
  | 'email_draft'
  | 'calendar_search'
  | 'contact_lookup'
  | 'meeting_analysis'
  | 'deal_health';

export interface ToolCall {
  id: string;
  tool: ToolType;
  state: ToolState;
  startTime: number;
  steps: ToolStep[];
  result?: any;
}

export interface ToolStep {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'complete';
  icon: string;
  duration?: number;
  metadata?: Record<string, any>;
}
