/**
 * Autonomous Agent Module
 *
 * Exports the autonomous agent orchestrator and related components.
 *
 * @example
 * ```typescript
 * import { createAutonomousAgent, AutonomousAgent } from '@/lib/copilot/agent';
 *
 * const agent = createAutonomousAgent({
 *   organizationId: 'org-123',
 *   userId: 'user-456'
 * });
 *
 * for await (const event of agent.run("Help me outreach to 50 leads")) {
 *   // Handle events
 * }
 * ```
 */

// Main Agent
export { AutonomousAgent, createAutonomousAgent } from './agent';

// Understanding Engine
export { UnderstandingEngine, createUnderstandingEngine } from './understand';

// Planning Engine
export { PlanningEngine, createPlanningEngine } from './planner';

// Types
export type {
  // State types
  AgentPhase,
  AgentState,
  AgentGoal,
  AgentConfig,

  // Plan types
  ExecutionPlan,
  PlannedStep,
  SkillGap,
  ExecutionReport,

  // Message types
  AgentMessage,
  AgentMessageType,
  QuestionOption,
  UserResponse,

  // Event types
  AgentEvent,
  AgentEventHandler,

  // AI service types
  UnderstandingRequest,
  UnderstandingResponse,
  PlanningRequest,
  PlanningResponse,
} from './types';
