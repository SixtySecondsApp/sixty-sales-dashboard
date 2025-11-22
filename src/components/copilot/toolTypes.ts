/**
 * Tool Call Types for Copilot Animations
 * Defines the visual tool types used in the copilot UI
 */

export type ToolType =
  | 'task_search'
  | 'pipeline_data'
  | 'email_draft'
  | 'email_search'
  | 'calendar_search'
  | 'contact_lookup'
  | 'contact_search'
  | 'deal_health'
  | 'meeting_analysis'
  | 'roadmap_create'
  | 'sales_coach';

export type ToolState = 
  | 'initiating'
  | 'fetching'
  | 'processing'
  | 'completing'
  | 'complete';

export interface ToolStep {
  id: string;
  label: string;
  icon: string;
  state: ToolState;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  tool: ToolType;
  state: ToolState;
  startTime: number;
  endTime?: number;
  steps: ToolStep[];
  result?: any;
  error?: string;
}

