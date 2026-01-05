/**
 * Autonomous Agent Types
 *
 * Type definitions for the autonomous copilot agent that orchestrates
 * skills to accomplish user goals through the UNDERSTAND → PLAN → EXECUTE → REPORT loop.
 */

import type { Skill, SkillFrontmatter } from '@/lib/mcp/skillsProvider';
import type { SkillContext, SkillResult, WorkflowResult } from '@/lib/mcp/skillsTools';

// =============================================================================
// Agent State Types
// =============================================================================

/**
 * Current phase of the autonomous agent
 */
export type AgentPhase = 'idle' | 'understand' | 'plan' | 'execute' | 'report';

/**
 * Agent's understanding of the user's goal
 */
export interface AgentGoal {
  /** Raw user message */
  rawMessage: string;
  /** Parsed goal statement */
  goalStatement: string;
  /** Extracted intent category */
  intentCategory?: 'outreach' | 'research' | 'email' | 'meeting' | 'task' | 'analysis' | 'general';
  /** Key requirements extracted from conversation */
  requirements: Record<string, unknown>;
  /** Confidence score (0-1) that we understand the goal */
  confidence: number;
}

/**
 * A planned step in the execution sequence
 */
export interface PlannedStep {
  /** Order in the sequence (0-indexed) */
  order: number;
  /** Skill to execute */
  skillKey: string;
  /** Skill metadata */
  skill: Skill;
  /** Why this skill was chosen */
  purpose: string;
  /** Context to pass to the skill */
  inputContext: Partial<SkillContext>;
  /** Keys this step will output */
  outputKeys: string[];
  /** Whether this step depends on previous steps */
  dependencies: number[];
  /** Status of this step */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Result if completed */
  result?: SkillResult;
  /** Error if failed */
  error?: string;
}

/**
 * Skills that would help but aren't available
 */
export interface SkillGap {
  /** What capability is missing */
  capability: string;
  /** What the user would need to accomplish this */
  requirement: string;
  /** Suggested integration or action */
  suggestion?: string;
}

/**
 * Complete execution plan
 */
export interface ExecutionPlan {
  /** The goal this plan addresses */
  goal: AgentGoal;
  /** Ordered steps to execute */
  steps: PlannedStep[];
  /** Skills we'd need but don't have */
  gaps: SkillGap[];
  /** What we CAN accomplish with available skills */
  canAccomplish: string;
  /** What we CANNOT accomplish (needs more skills) */
  limitations: string[];
  /** Estimated complexity (1-10) */
  complexity: number;
}

/**
 * Final report after execution
 */
export interface ExecutionReport {
  /** What was successfully accomplished */
  accomplished: string[];
  /** Key outputs produced */
  outputs: Record<string, unknown>;
  /** What couldn't be done (gaps) */
  gaps: SkillGap[];
  /** Suggested next steps for the user */
  nextSteps: string[];
  /** Overall success (true if any value was delivered) */
  success: boolean;
  /** Summary message */
  summary: string;
}

/**
 * Complete agent state
 */
export interface AgentState {
  /** Current phase */
  phase: AgentPhase;
  /** Parsed goal */
  goal: AgentGoal | null;
  /** Accumulated context from all steps */
  context: SkillContext;
  /** Execution plan */
  plan: ExecutionPlan | null;
  /** Steps that have been executed */
  executedSteps: PlannedStep[];
  /** Identified skill gaps */
  gaps: SkillGap[];
  /** Conversation history */
  conversationHistory: AgentMessage[];
  /** Session ID */
  sessionId: string;
  /** When the session started */
  startedAt: Date;
  /** Error if any */
  error?: string;
}

// =============================================================================
// Agent Message Types
// =============================================================================

/**
 * Types of agent responses to the user
 */
export type AgentMessageType =
  | 'question'      // Asking for clarification
  | 'plan'          // Showing the execution plan
  | 'progress'      // Skill execution progress
  | 'result'        // Skill execution result
  | 'report'        // Final execution report
  | 'error'         // Error message
  | 'info';         // General information

/**
 * A question option for the user to select
 */
export interface QuestionOption {
  /** Display label */
  label: string;
  /** Value to use if selected */
  value: string;
  /** Optional description */
  description?: string;
}

/**
 * Message from the agent to the user
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: AgentMessageType;
  /** Main content */
  content: string;
  /** When the message was created */
  timestamp: Date;
  /** Question options (for type='question') */
  options?: QuestionOption[];
  /** Whether multiple options can be selected */
  multiSelect?: boolean;
  /** Current plan (for type='plan') */
  plan?: ExecutionPlan;
  /** Current skill progress (for type='progress') */
  progress?: {
    skillKey: string;
    skillName: string;
    status: 'running' | 'completed' | 'failed';
    stepIndex: number;
    totalSteps: number;
  };
  /** Skill result (for type='result') */
  result?: SkillResult | WorkflowResult;
  /** Final report (for type='report') */
  report?: ExecutionReport;
  /** Skill gaps mentioned */
  gaps?: SkillGap[];
  /** Associated metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User's response to an agent message
 */
export interface UserResponse {
  /** Message ID being responded to */
  messageId: string;
  /** User's response text */
  text?: string;
  /** Selected option(s) if applicable */
  selectedOptions?: string[];
  /** Timestamp */
  timestamp: Date;
}

// =============================================================================
// Agent Configuration
// =============================================================================

/**
 * Configuration for the autonomous agent
 */
export interface AgentConfig {
  /** Organization ID for skill access */
  organizationId: string;
  /** User ID */
  userId: string;
  /** Maximum questions to ask before proceeding */
  maxQuestions?: number;
  /** Confidence threshold to stop asking questions (0-1) */
  confidenceThreshold?: number;
  /** Whether to auto-execute after planning */
  autoExecute?: boolean;
  /** Whether to show progress updates */
  showProgress?: boolean;
  /** Custom context to seed the agent */
  initialContext?: Partial<SkillContext>;
}

// =============================================================================
// Agent Events (for streaming updates)
// =============================================================================

/**
 * Events emitted by the agent during execution
 */
export type AgentEvent =
  | { type: 'phase_change'; phase: AgentPhase }
  | { type: 'message'; message: AgentMessage }
  | { type: 'question'; message: AgentMessage }
  | { type: 'plan_created'; plan: ExecutionPlan }
  | { type: 'step_start'; step: PlannedStep }
  | { type: 'step_complete'; step: PlannedStep; result: SkillResult }
  | { type: 'step_failed'; step: PlannedStep; error: string }
  | { type: 'report'; report: ExecutionReport }
  | { type: 'error'; error: string }
  | { type: 'complete' };

/**
 * Callback for agent events
 */
export type AgentEventHandler = (event: AgentEvent) => void;

// =============================================================================
// AI Service Types (for understanding and planning)
// =============================================================================

/**
 * Request to the AI for understanding user intent
 */
export interface UnderstandingRequest {
  /** User's message */
  message: string;
  /** Current context */
  context: SkillContext;
  /** Conversation history */
  history: AgentMessage[];
  /** Available skills (for context) */
  availableSkills: Array<{
    key: string;
    name: string;
    description: string;
    category: string;
  }>;
}

/**
 * Response from AI for understanding
 */
export interface UnderstandingResponse {
  /** Whether we have enough info to proceed */
  understood: boolean;
  /** Parsed goal statement */
  goal: string;
  /** Next question to ask (if not understood) */
  question?: string;
  /** Options for the question */
  options?: QuestionOption[];
  /** Context extracted from the message */
  extractedContext: Record<string, unknown>;
  /** Confidence score */
  confidence: number;
  /** Detected intent category */
  intentCategory?: AgentGoal['intentCategory'];
}

/**
 * Request to the AI for planning
 */
export interface PlanningRequest {
  /** The goal to accomplish */
  goal: AgentGoal;
  /** Available skills */
  availableSkills: Skill[];
  /** Current context */
  context: SkillContext;
}

/**
 * Response from AI for planning
 */
export interface PlanningResponse {
  /** Ordered skill keys to execute */
  steps: Array<{
    skillKey: string;
    purpose: string;
    inputMapping?: Record<string, string>;
    outputKey?: string;
  }>;
  /** What we can accomplish */
  canAccomplish: string;
  /** Identified gaps (capabilities we need but don't have) */
  gaps: SkillGap[];
  /** Estimated complexity */
  complexity: number;
}
