/**
 * MCP Skills Tools
 *
 * Tools for executing skills and workflows via the MCP protocol.
 * Provides skill execution, workflow orchestration, and status tracking.
 *
 * Features:
 * - Execute individual skills with context
 * - Execute multi-step workflows
 * - Track execution status
 * - Handle skill dependencies
 *
 * @see platform-controlled-skills-for-orgs.md - Phase 5: Agent Integration
 */

import { supabase } from '../supabase/clientV2';
import { SkillsProvider, Skill } from './skillsProvider';

// =============================================================================
// Types
// =============================================================================

/**
 * Context provided to a skill during execution
 */
export interface SkillContext {
  // Organization context (from organization_context table)
  company_name?: string;
  industry?: string;
  products?: Array<{ name: string; description: string }>;
  competitors?: string[];
  target_market?: string;
  icp_summary?: string;
  brand_tone?: string;

  // Entity-specific context (passed by the caller)
  entity_type?: 'lead' | 'deal' | 'contact' | 'meeting' | 'task';
  entity_id?: string;
  entity_data?: Record<string, unknown>;

  // User context
  user_id?: string;
  user_name?: string;

  // Additional custom context
  [key: string]: unknown;
}

/**
 * Result from executing a skill
 */
export interface SkillResult {
  success: boolean;
  execution_id: string;
  skill_key: string;
  output?: unknown;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result from executing a workflow
 */
export interface WorkflowResult {
  success: boolean;
  execution_id: string;
  workflow_key: string;
  steps: WorkflowStepResult[];
  output?: unknown;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

/**
 * Result from a single workflow step
 */
export interface WorkflowStepResult {
  step_index: number;
  skill_key: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Execution status for tracking progress
 */
export interface ExecutionStatus {
  execution_id: string;
  type: 'skill' | 'workflow';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100 for workflows
  current_step?: string;
  output?: unknown;
  error?: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * Workflow definition (from 'workflows' category skills)
 */
interface WorkflowDefinition {
  skill_key: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  on_error?: 'stop' | 'continue' | 'retry';
  max_retries?: number;
}

/**
 * Individual workflow step
 */
interface WorkflowStep {
  skill_key: string;
  condition?: string; // Expression to evaluate
  input_mapping?: Record<string, string>; // Map workflow context to skill context
  output_key?: string; // Key to store output in workflow context
}

// =============================================================================
// In-Memory Execution Store (for demo/development)
// In production, this would be stored in the database
// =============================================================================

const executionStore = new Map<string, ExecutionStatus>();

// =============================================================================
// Skills Tools Class
// =============================================================================

/**
 * SkillsTools - Tools for executing skills and workflows
 *
 * Usage:
 * ```typescript
 * const tools = new SkillsTools(organizationId);
 *
 * // Execute a skill
 * const result = await tools.executeSkill('lead-qualification', {
 *   entity_type: 'lead',
 *   entity_id: 'lead-123',
 *   entity_data: { ... }
 * });
 *
 * // Execute a workflow
 * const workflowResult = await tools.executeWorkflow('new-lead-workflow', {
 *   lead_id: 'lead-123'
 * });
 *
 * // Check status
 * const status = await tools.getSkillStatus(result.execution_id);
 * ```
 */
export class SkillsTools {
  private organizationId: string;
  private provider: SkillsProvider;
  private organizationContext: SkillContext | null = null;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
    this.provider = new SkillsProvider(organizationId);
  }

  /**
   * Execute a skill with the given context
   *
   * @param skillKey - The skill to execute
   * @param context - Context data for the skill
   * @returns Skill execution result
   */
  async executeSkill(skillKey: string, context: SkillContext = {}): Promise<SkillResult> {
    const executionId = this.generateExecutionId('skill');
    const startedAt = new Date().toISOString();

    // Initialize execution status
    this.updateExecutionStatus(executionId, {
      execution_id: executionId,
      type: 'skill',
      status: 'running',
      started_at: startedAt,
      updated_at: startedAt,
    });

    try {
      // Get the skill
      const skill = await this.provider.getSkill(skillKey);
      if (!skill) {
        throw new Error(`Skill not found: ${skillKey}`);
      }

      // Merge with organization context
      const fullContext = await this.buildFullContext(context);

      // Validate required context
      this.validateRequiredContext(skill, fullContext);

      // Execute the skill (this is where AI would process the skill content)
      const output = await this.processSkill(skill, fullContext);

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Update execution status
      this.updateExecutionStatus(executionId, {
        execution_id: executionId,
        type: 'skill',
        status: 'completed',
        output,
        started_at: startedAt,
        updated_at: completedAt,
        completed_at: completedAt,
      });

      return {
        success: true,
        execution_id: executionId,
        skill_key: skillKey,
        output,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        metadata: {
          skill_version: skill.version,
          category: skill.category,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const completedAt = new Date().toISOString();

      // Update execution status
      this.updateExecutionStatus(executionId, {
        execution_id: executionId,
        type: 'skill',
        status: 'failed',
        error: errorMessage,
        started_at: startedAt,
        updated_at: completedAt,
        completed_at: completedAt,
      });

      return {
        success: false,
        execution_id: executionId,
        skill_key: skillKey,
        error: errorMessage,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      };
    }
  }

  /**
   * Execute a workflow (multi-skill sequence)
   *
   * @param workflowKey - The workflow skill key
   * @param context - Initial context for the workflow
   * @returns Workflow execution result
   */
  async executeWorkflow(
    workflowKey: string,
    context: SkillContext = {}
  ): Promise<WorkflowResult> {
    const executionId = this.generateExecutionId('workflow');
    const startedAt = new Date().toISOString();
    const stepResults: WorkflowStepResult[] = [];

    // Initialize execution status
    this.updateExecutionStatus(executionId, {
      execution_id: executionId,
      type: 'workflow',
      status: 'running',
      progress: 0,
      started_at: startedAt,
      updated_at: startedAt,
    });

    try {
      // Get the workflow skill
      const workflowSkill = await this.provider.getSkill(workflowKey);
      if (!workflowSkill) {
        throw new Error(`Workflow not found: ${workflowKey}`);
      }

      // Parse workflow definition from skill content
      const workflow = this.parseWorkflowDefinition(workflowSkill);

      // Merge with organization context
      let workflowContext = await this.buildFullContext(context);

      // Execute each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const progress = Math.round(((i + 1) / workflow.steps.length) * 100);

        // Update progress
        this.updateExecutionStatus(executionId, {
          execution_id: executionId,
          type: 'workflow',
          status: 'running',
          progress,
          current_step: step.skill_key,
          started_at: startedAt,
          updated_at: new Date().toISOString(),
        });

        // Check condition if specified
        if (step.condition && !this.evaluateCondition(step.condition, workflowContext)) {
          stepResults.push({
            step_index: i,
            skill_key: step.skill_key,
            status: 'skipped',
          });
          continue;
        }

        // Map inputs for this step
        const stepContext = this.mapInputs(step.input_mapping, workflowContext);

        // Execute the step skill
        const stepStartedAt = new Date().toISOString();
        try {
          const stepResult = await this.executeSkill(step.skill_key, stepContext);

          if (!stepResult.success) {
            throw new Error(stepResult.error || 'Step execution failed');
          }

          // Store output in workflow context if output_key specified
          if (step.output_key && stepResult.output) {
            workflowContext = {
              ...workflowContext,
              [step.output_key]: stepResult.output,
            };
          }

          stepResults.push({
            step_index: i,
            skill_key: step.skill_key,
            status: 'completed',
            output: stepResult.output,
            started_at: stepStartedAt,
            completed_at: new Date().toISOString(),
          });
        } catch (stepError) {
          const stepErrorMessage =
            stepError instanceof Error ? stepError.message : String(stepError);

          stepResults.push({
            step_index: i,
            skill_key: step.skill_key,
            status: 'failed',
            error: stepErrorMessage,
            started_at: stepStartedAt,
            completed_at: new Date().toISOString(),
          });

          // Handle error based on workflow configuration
          if (workflow.on_error === 'stop' || !workflow.on_error) {
            throw new Error(`Workflow step failed: ${step.skill_key} - ${stepErrorMessage}`);
          }
          // If on_error is 'continue', keep going
        }
      }

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Update final status
      this.updateExecutionStatus(executionId, {
        execution_id: executionId,
        type: 'workflow',
        status: 'completed',
        progress: 100,
        output: workflowContext,
        started_at: startedAt,
        updated_at: completedAt,
        completed_at: completedAt,
      });

      return {
        success: true,
        execution_id: executionId,
        workflow_key: workflowKey,
        steps: stepResults,
        output: workflowContext,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const completedAt = new Date().toISOString();

      // Update final status
      this.updateExecutionStatus(executionId, {
        execution_id: executionId,
        type: 'workflow',
        status: 'failed',
        error: errorMessage,
        started_at: startedAt,
        updated_at: completedAt,
        completed_at: completedAt,
      });

      return {
        success: false,
        execution_id: executionId,
        workflow_key: workflowKey,
        steps: stepResults,
        error: errorMessage,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      };
    }
  }

  /**
   * Get the status of a skill or workflow execution
   *
   * @param executionId - The execution ID to check
   * @returns Execution status or null if not found
   */
  async getSkillStatus(executionId: string): Promise<ExecutionStatus | null> {
    // Check in-memory store first
    const status = executionStore.get(executionId);
    if (status) {
      return status;
    }

    // In production, this would query the database
    // For now, return null if not in memory
    return null;
  }

  /**
   * List recent executions for the organization
   *
   * @param limit - Maximum number of executions to return
   * @param type - Filter by execution type
   * @returns Array of execution statuses
   */
  async listExecutions(
    limit = 20,
    type?: 'skill' | 'workflow'
  ): Promise<ExecutionStatus[]> {
    const executions = Array.from(executionStore.values())
      .filter((e) => !type || e.type === type)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, limit);

    return executions;
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Update execution status in the store
   */
  private updateExecutionStatus(executionId: string, status: ExecutionStatus): void {
    executionStore.set(executionId, status);

    // Clean up old executions (keep last 1000)
    if (executionStore.size > 1000) {
      const sortedEntries = Array.from(executionStore.entries()).sort(
        (a, b) => new Date(b[1].started_at).getTime() - new Date(a[1].started_at).getTime()
      );
      const toDelete = sortedEntries.slice(1000);
      toDelete.forEach(([key]) => executionStore.delete(key));
    }
  }

  /**
   * Load organization context from the database
   */
  private async loadOrganizationContext(): Promise<SkillContext> {
    if (this.organizationContext) {
      return this.organizationContext;
    }

    try {
      // Query organization_context table
      // Note: Using type assertion because the table may not be in generated types yet
      const { data: contextRows, error } = await supabase
        .from('organization_context' as 'profiles')
        .select('context_key, value')
        .eq('organization_id', this.organizationId) as unknown as {
          data: Array<{ context_key: string; value: unknown }> | null;
          error: Error | null;
        };

      if (error) {
        console.error('[SkillsTools.loadOrganizationContext] Error:', error);
        return {};
      }

      // Build context object from key-value pairs
      const context: SkillContext = {};
      (contextRows || []).forEach((row: { context_key: string; value: unknown }) => {
        context[row.context_key] = row.value;
      });

      this.organizationContext = context;
      return context;
    } catch (error) {
      console.error('[SkillsTools.loadOrganizationContext] Error:', error);
      return {};
    }
  }

  /**
   * Build full context by merging organization context with provided context
   */
  private async buildFullContext(providedContext: SkillContext): Promise<SkillContext> {
    const orgContext = await this.loadOrganizationContext();
    return {
      ...orgContext,
      ...providedContext,
    };
  }

  /**
   * Validate that required context variables are present
   */
  private validateRequiredContext(skill: Skill, context: SkillContext): void {
    const requiredContext = skill.frontmatter?.requires_context || [];

    for (const key of requiredContext) {
      if (context[key] === undefined || context[key] === null) {
        console.warn(
          `[SkillsTools.validateRequiredContext] Missing context: ${key} for skill ${skill.skill_key}`
        );
        // Don't throw - just warn, as AI can often work with partial context
      }
    }
  }

  /**
   * Process a skill (placeholder for AI integration)
   *
   * In production, this would:
   * 1. Send the skill content to an AI model
   * 2. Include the context for variable interpolation
   * 3. Return the AI's output
   *
   * For now, returns the skill content with context info
   */
  private async processSkill(skill: Skill, context: SkillContext): Promise<unknown> {
    // This is a placeholder - in production, this would call an AI service
    // For now, return the skill metadata and context to indicate what would be processed

    return {
      skill_processed: skill.skill_key,
      skill_name: skill.frontmatter?.name,
      category: skill.category,
      context_available: Object.keys(context),
      content_preview: skill.content.substring(0, 200) + '...',
      message:
        'Skill execution placeholder. In production, this would be processed by an AI model.',
    };
  }

  /**
   * Parse a workflow definition from a workflow skill
   */
  private parseWorkflowDefinition(skill: Skill): WorkflowDefinition {
    // Try to extract workflow steps from frontmatter or content
    const frontmatter = skill.frontmatter;

    // If frontmatter has a 'steps' array, use it
    if (frontmatter && Array.isArray((frontmatter as unknown as { steps?: unknown }).steps)) {
      return {
        skill_key: skill.skill_key,
        name: frontmatter.name || skill.skill_key,
        description: frontmatter.description || '',
        steps: (frontmatter as unknown as { steps: WorkflowStep[] }).steps,
        on_error:
          ((frontmatter as unknown as { on_error?: string }).on_error as
            | 'stop'
            | 'continue'
            | 'retry') || 'stop',
        max_retries: (frontmatter as unknown as { max_retries?: number }).max_retries || 1,
      };
    }

    // Otherwise, try to parse steps from the content (markdown list format)
    const steps = this.parseStepsFromContent(skill.content);

    return {
      skill_key: skill.skill_key,
      name: skill.frontmatter?.name || skill.skill_key,
      description: skill.frontmatter?.description || '',
      steps,
      on_error: 'stop',
      max_retries: 1,
    };
  }

  /**
   * Parse workflow steps from markdown content
   *
   * Looks for patterns like:
   * - Step 1: Execute `skill-name`
   * - Step 2: If qualified, execute `follow-up-email`
   */
  private parseStepsFromContent(content: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Look for skill references in backticks
    const skillPattern = /`([a-z0-9-]+)`/g;
    let match;

    while ((match = skillPattern.exec(content)) !== null) {
      const skillKey = match[1];
      // Avoid duplicates
      if (!steps.some((s) => s.skill_key === skillKey)) {
        steps.push({ skill_key: skillKey });
      }
    }

    // If no skills found, return empty array
    return steps;
  }

  /**
   * Evaluate a condition expression
   *
   * Simple condition evaluator supporting:
   * - score >= 70
   * - status == 'qualified'
   * - exists(entity_data)
   */
  private evaluateCondition(condition: string, context: SkillContext): boolean {
    try {
      // Simple pattern matching for common conditions
      // In production, this could use a proper expression parser

      // Check for comparison operators
      const comparisonMatch = condition.match(/^(\w+)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
      if (comparisonMatch) {
        const [, key, operator, valueStr] = comparisonMatch;
        const contextValue = context[key];
        let compareValue: string | number = valueStr.trim();

        // Try to parse as number
        if (!isNaN(Number(compareValue))) {
          compareValue = Number(compareValue);
        } else {
          // Remove quotes if present
          compareValue = compareValue.replace(/^['"]|['"]$/g, '');
        }

        switch (operator) {
          case '>=':
            return Number(contextValue) >= Number(compareValue);
          case '<=':
            return Number(contextValue) <= Number(compareValue);
          case '>':
            return Number(contextValue) > Number(compareValue);
          case '<':
            return Number(contextValue) < Number(compareValue);
          case '==':
            return contextValue == compareValue;
          case '!=':
            return contextValue != compareValue;
        }
      }

      // Check for exists()
      const existsMatch = condition.match(/^exists\((\w+)\)$/);
      if (existsMatch) {
        const key = existsMatch[1];
        return context[key] !== undefined && context[key] !== null;
      }

      // If we can't parse, return true (don't skip the step)
      console.warn(`[SkillsTools.evaluateCondition] Unknown condition format: ${condition}`);
      return true;
    } catch (error) {
      console.error('[SkillsTools.evaluateCondition] Error:', error);
      return true; // Default to executing the step
    }
  }

  /**
   * Map workflow context to step inputs based on input_mapping
   */
  private mapInputs(
    inputMapping: Record<string, string> | undefined,
    context: SkillContext
  ): SkillContext {
    if (!inputMapping) {
      return context;
    }

    const mappedContext: SkillContext = { ...context };

    for (const [targetKey, sourceKey] of Object.entries(inputMapping)) {
      if (context[sourceKey] !== undefined) {
        mappedContext[targetKey] = context[sourceKey];
      }
    }

    return mappedContext;
  }

  /**
   * Clear the organization context cache
   */
  clearContextCache(): void {
    this.organizationContext = null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SkillsTools instance
 */
export function createSkillsTools(organizationId: string): SkillsTools {
  return new SkillsTools(organizationId);
}
