/**
 * Agent Sequences Module
 *
 * Exports all Context Engineering components for agent sequence execution.
 *
 * Key Components:
 * - contextEngineering: Types and interfaces for the Context Engineering pattern
 * - SequenceStateManager: Mutable state management throughout execution
 * - ContextCompactor: Compaction utilities for efficient context management
 * - SequenceOrchestrator: Main orchestration layer with hierarchical tool routing
 *
 * @example
 * ```typescript
 * import {
 *   createSequenceOrchestrator,
 *   createSequenceStateManager,
 *   type SkillResult,
 *   type SequenceState,
 * } from '@/lib/sequences';
 *
 * const orchestrator = createSequenceOrchestrator({
 *   supabase,
 *   organizationId: 'org-123',
 *   userId: 'user-456',
 * });
 *
 * const result = await orchestrator.executeSequence(sequence, trigger);
 * ```
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type {
  // Skill Result Contract
  SkillResult,
  Reference,
  SkillHints,
  SkillFlag,
  SkillMeta,

  // Sequence State
  SequenceState,
  SequenceType,
  SequenceTrigger,
  ExecutionTracking,
  FailedSkill,
  SequenceContext,

  // Entity Summaries
  ContactSummary,
  CompanySummary,
  DealSummary,

  // Findings
  ActionItem,
  Risk,
  Opportunity,

  // Approval & Outputs
  ApprovalState,
  SequenceOutputs,
  DraftOutput,
  NotificationOutput,
  CRMUpdate,
  TaskOutput,

  // Token Budget
  TokenBudget,

  // Orchestrator Tools (Level 1)
  OrchestratorTool,
  ResearchParams,
  EnrichParams,
  DraftParams,
  DraftContext,
  CRMActionParams,
  NotifyParams,
  ExecuteParams,
} from './contextEngineering';

export {
  // Constants
  SKILL_ROUTING,
  CONTEXT_ENGINEERING_RULES,
  TOKEN_BUDGET_DEFAULTS,

  // Factory Functions
  createInitialSequenceState,
  createSkillResult,
  createFailedSkillResult,

  // Utility Functions
  estimateTokens,
  validateSkillResult,
  compactSummary,
} from './contextEngineering';

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

export { SequenceStateManager, createSequenceStateManager } from './SequenceStateManager';

// =============================================================================
// CONTEXT COMPACTION
// =============================================================================

export type { RawSkillOutput, StorageConfig, CompactionResult } from './ContextCompactor';

export {
  ContextCompactor,
  createContextCompactor,
  quickCompact,
  shouldCompactData,
} from './ContextCompactor';

// =============================================================================
// ORCHESTRATION
// =============================================================================

export type {
  OrchestratorConfig,
  SequenceExecutionResult,
} from './SequenceOrchestrator';

export { SequenceOrchestrator, createSequenceOrchestrator } from './SequenceOrchestrator';
