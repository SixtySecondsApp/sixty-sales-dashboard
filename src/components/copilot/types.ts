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
  | 'contact_search'
  | 'deal_health'
  | 'contact_search'
  | 'task_search'
  | 'roadmap_create'
  | 'sales_coach';

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

// ============================================================================
// Structured Response Types
// ============================================================================

export type CopilotResponseType = 'activity' | 'pipeline' | 'meeting' | 'email' | 'calendar' | 'lead' | 'task' | 'contact' | 'roadmap' | 'sales_coach';

export interface CopilotResponse {
  type: CopilotResponseType;
  summary: string; // Brief intro text
  data: ResponseData;
  actions: QuickActionResponse[];
  metadata?: ResponseMetadata;
}

export interface QuickActionResponse {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'tertiary';
  icon?: string;
  callback: string; // API endpoint or action name
  params?: Record<string, any>;
}

export interface ResponseMetadata {
  totalCount?: number;
  timeGenerated: string;
  dataSource: string[];
  confidence?: number; // 0-100
}

export type ResponseData = 
  | PipelineResponseData
  | EmailResponseData
  | CalendarResponseData
  | ActivityResponseData
  | LeadResponseData
  | TaskResponseData
  | ContactResponseData
  | RoadmapResponseData
  | SalesCoachResponseData;

// Roadmap Response
export interface RoadmapResponse extends CopilotResponse {
  type: 'roadmap' | 'sales_coach';
  data: RoadmapResponseData;
}

export interface RoadmapResponseData {
  roadmapItem: RoadmapItem;
  success: boolean;
  message: string;
}

export interface RoadmapItem {
  id: string;
  ticket_id?: string;
  title: string;
  description?: string;
  type: 'feature' | 'bug' | 'improvement' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'rejected';
  submitted_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Placeholder types for other response types (to satisfy TypeScript)
export interface PipelineResponseData {
  criticalDeals: any[];
  highPriorityDeals: any[];
  metrics: any;
}

export interface EmailResponseData {
  email: any;
  context: any;
  suggestions: any[];
}

export interface CalendarResponseData {
  meetings: any[];
}

export interface ActivityResponseData {
  created?: any[];
  upcoming?: any[];
  overdue?: any[];
}

export interface LeadResponseData {
  newLeads: any[];
  hotLeads: any[];
  needsQualification: any[];
  metrics: any;
}

export interface TaskResponseData {
  urgentTasks: any[];
  highPriorityTasks: any[];
  dueToday: any[];
  overdue: any[];
  upcoming: any[];
  metrics: any;
}

export interface ContactResponseData {
  contact: any;
  emails: any[];
  deals: any[];
  activities: any[];
  meetings: any[];
  tasks: any[];
  metrics: any;
}

// Sales Coach Response
export interface SalesCoachResponse extends CopilotResponse {
  type: 'sales_coach';
  data: SalesCoachResponseData;
}

export interface SalesCoachResponseData {
  comparison: PerformanceComparison;
  metrics: SalesMetrics;
  insights: Insight[];
  recommendations: Recommendation[];
  period: {
    current: { month: string; year: number; day: number };
    previous: { month: string; year: number; day: number };
  };
}

export interface PerformanceComparison {
  sales: MetricComparison;
  activities: MetricComparison;
  pipeline: MetricComparison;
  overall: 'significantly_better' | 'better' | 'similar' | 'worse' | 'significantly_worse';
}

export interface MetricComparison {
  current: number;
  previous: number;
  change: number; // percentage change
  changeType: 'increase' | 'decrease' | 'neutral';
  verdict: string;
}

export interface SalesMetrics {
  currentMonth: MonthMetrics;
  previousMonth: MonthMetrics;
}

export interface MonthMetrics {
  closedDeals: number;
  totalRevenue: number;
  averageDealValue: number;
  meetings: number;
  outboundActivities: number;
  totalActivities: number;
  pipelineValue: number;
  deals: DealSummary[];
}

export interface DealSummary {
  id: string;
  name: string;
  value: number;
  stage: string;
  closedDate?: string;
}

export interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'opportunity' | 'neutral';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems?: string[];
}
