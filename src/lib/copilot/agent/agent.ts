/**
 * Autonomous Agent
 *
 * Main orchestrator that implements the UNDERSTAND → PLAN → EXECUTE → REPORT loop.
 * Uses existing SkillsProvider and SkillsTools infrastructure.
 *
 * @example
 * ```typescript
 * const agent = new AutonomousAgent({
 *   organizationId: 'org-123',
 *   userId: 'user-456'
 * });
 *
 * // Start the agent with a user message
 * for await (const event of agent.run("Help me outreach to 50 SaaS leads")) {
 *   switch (event.type) {
 *     case 'question':
 *       // Show question to user, get response, then:
 *       agent.respond(event.message.id, userAnswer);
 *       break;
 *     case 'progress':
 *       // Update UI with execution progress
 *       break;
 *     case 'report':
 *       // Show final results
 *       break;
 *   }
 * }
 * ```
 */

import { SkillsProvider, Skill } from '@/lib/mcp/skillsProvider';
import { SkillsTools, SkillContext, SkillResult } from '@/lib/mcp/skillsTools';
import { UnderstandingEngine, createUnderstandingEngine } from './understand';
import { PlanningEngine, createPlanningEngine } from './planner';
import type {
  AgentConfig,
  AgentState,
  AgentPhase,
  AgentGoal,
  AgentMessage,
  AgentEvent,
  AgentEventHandler,
  ExecutionPlan,
  ExecutionReport,
  PlannedStep,
  SkillGap,
  UserResponse,
  UnderstandingResponse,
} from './types';

// =============================================================================
// Autonomous Agent Class
// =============================================================================

/**
 * AutonomousAgent - Main orchestrator for goal-driven skill execution
 */
export class AutonomousAgent {
  private config: Required<AgentConfig>;
  private state: AgentState;
  private skillsProvider: SkillsProvider;
  private skillsTools: SkillsTools;
  private understandingEngine: UnderstandingEngine;
  private planningEngine: PlanningEngine;

  // Event handling
  private eventHandlers: AgentEventHandler[] = [];
  private responseResolver: ((response: UserResponse) => void) | null = null;

  constructor(config: AgentConfig) {
    // Apply defaults
    this.config = {
      organizationId: config.organizationId,
      userId: config.userId,
      maxQuestions: config.maxQuestions ?? 5,
      confidenceThreshold: config.confidenceThreshold ?? 0.8,
      autoExecute: config.autoExecute ?? true,
      showProgress: config.showProgress ?? true,
      initialContext: config.initialContext ?? {},
    };

    // Initialize state
    this.state = {
      phase: 'idle',
      goal: null,
      context: {
        user_id: this.config.userId,
        ...this.config.initialContext,
      },
      plan: null,
      executedSteps: [],
      gaps: [],
      conversationHistory: [],
      sessionId: this.generateSessionId(),
      startedAt: new Date(),
    };

    // Initialize components
    this.skillsProvider = new SkillsProvider(config.organizationId);
    this.skillsTools = new SkillsTools(config.organizationId);
    this.understandingEngine = createUnderstandingEngine(
      this.config.maxQuestions,
      this.config.confidenceThreshold
    );
    this.planningEngine = createPlanningEngine();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Run the autonomous agent with a user message
   *
   * This is an async generator that yields events as the agent progresses.
   */
  async *run(message: string): AsyncGenerator<AgentEvent> {
    try {
      // Add user message to history
      this.addUserMessage(message);

      // Phase 1: UNDERSTAND
      yield* this.runUnderstandPhase(message);

      // If we need more info, wait (caller should call respond())
      if (this.state.phase === 'understand') {
        return;
      }

      // Phase 2: PLAN
      yield* this.runPlanPhase();

      // Phase 3: EXECUTE (if autoExecute enabled)
      if (this.config.autoExecute && this.state.plan?.steps.length) {
        yield* this.runExecutePhase();
      }

      // Phase 4: REPORT
      yield* this.runReportPhase();

      yield { type: 'complete' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.state.error = errorMessage;
      yield { type: 'error', error: errorMessage };
    }
  }

  /**
   * Respond to a question from the agent
   */
  async *respond(messageId: string, response: string | string[]): AsyncGenerator<AgentEvent> {
    const responseText = Array.isArray(response) ? response.join(', ') : response;

    // Add response to conversation
    this.addUserMessage(responseText);

    // Extract context from response
    const lastQuestion = this.state.conversationHistory.find(
      (m) => m.id === messageId && m.type === 'question'
    );

    if (lastQuestion) {
      const extractedContext = await this.understandingEngine.extractFromResponse(
        lastQuestion,
        responseText,
        this.state.context
      );

      // Merge into state context
      this.state.context = { ...this.state.context, ...extractedContext };
    }

    // Continue understanding with the response
    yield* this.runUnderstandPhase(responseText);

    // If still asking questions, return
    if (this.state.phase === 'understand') {
      return;
    }

    // Continue to planning and execution
    yield* this.runPlanPhase();

    if (this.config.autoExecute && this.state.plan?.steps.length) {
      yield* this.runExecutePhase();
    }

    yield* this.runReportPhase();
    yield { type: 'complete' };
  }

  /**
   * Execute the current plan (if not auto-executing)
   */
  async *execute(): AsyncGenerator<AgentEvent> {
    if (!this.state.plan) {
      yield { type: 'error', error: 'No plan to execute' };
      return;
    }

    yield* this.runExecutePhase();
    yield* this.runReportPhase();
    yield { type: 'complete' };
  }

  /**
   * Get current agent state
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.state.conversationHistory];
  }

  /**
   * Subscribe to agent events
   */
  onEvent(handler: AgentEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  /**
   * Reset the agent for a new conversation
   */
  reset(): void {
    this.state = {
      phase: 'idle',
      goal: null,
      context: {
        user_id: this.config.userId,
        ...this.config.initialContext,
      },
      plan: null,
      executedSteps: [],
      gaps: [],
      conversationHistory: [],
      sessionId: this.generateSessionId(),
      startedAt: new Date(),
    };

    this.understandingEngine.reset();
  }

  // ===========================================================================
  // Phase Implementations
  // ===========================================================================

  /**
   * UNDERSTAND Phase: Ask questions until we understand the goal
   */
  private async *runUnderstandPhase(message: string): AsyncGenerator<AgentEvent> {
    this.setPhase('understand');

    // Get available skills for context
    const availableSkills = await this.loadAvailableSkills();
    const skillsSummary = availableSkills.map((s) => ({
      key: s.skill_key,
      name: s.frontmatter?.name || s.skill_key,
      description: s.frontmatter?.description || '',
      category: s.category,
    }));

    // Assess understanding
    const assessment = await this.understandingEngine.assess({
      message,
      context: this.state.context,
      history: this.state.conversationHistory,
      availableSkills: skillsSummary,
    });

    // Extract context from assessment
    this.state.context = { ...this.state.context, ...assessment.extractedContext };

    if (assessment.understood) {
      // Build the goal
      this.state.goal = this.understandingEngine.buildGoal(
        this.state.conversationHistory[0]?.content || message,
        [assessment],
        this.state.context
      );

      // Info message about understanding
      const infoMessage = this.createMessage('info', `Got it! I'll help you: ${this.state.goal.goalStatement}`);
      this.state.conversationHistory.push(infoMessage);
      yield { type: 'message', message: infoMessage };
    } else {
      // Need to ask a question
      const questionMessage = this.understandingEngine.createQuestionMessage(assessment);
      this.state.conversationHistory.push(questionMessage);
      yield { type: 'question', message: questionMessage };
    }
  }

  /**
   * PLAN Phase: Create execution plan from goal and skills
   */
  private async *runPlanPhase(): AsyncGenerator<AgentEvent> {
    if (!this.state.goal) {
      throw new Error('Cannot plan without a goal');
    }

    this.setPhase('plan');

    // Load available skills
    const availableSkills = await this.loadAvailableSkills();

    // Create the plan
    const plan = await this.planningEngine.createPlan({
      goal: this.state.goal,
      availableSkills,
      context: this.state.context,
    });

    // Validate the plan
    const validation = this.planningEngine.validatePlan(plan);
    if (!validation.valid) {
      console.warn('[Agent.runPlanPhase] Plan validation issues:', validation.issues);
    }

    this.state.plan = plan;
    this.state.gaps = plan.gaps;

    // Create plan message
    const planMessage = this.createPlanMessage(plan);
    this.state.conversationHistory.push(planMessage);

    yield { type: 'plan_created', plan };
    yield { type: 'message', message: planMessage };
  }

  /**
   * EXECUTE Phase: Run each step in the plan
   */
  private async *runExecutePhase(): AsyncGenerator<AgentEvent> {
    if (!this.state.plan) {
      throw new Error('Cannot execute without a plan');
    }

    this.setPhase('execute');

    for (const step of this.state.plan.steps) {
      // Skip already completed steps
      if (step.status !== 'pending') continue;

      // Update step status
      step.status = 'running';
      yield { type: 'step_start', step };

      if (this.config.showProgress) {
        const progressMessage = this.createProgressMessage(step, this.state.plan.steps.length);
        this.state.conversationHistory.push(progressMessage);
        yield { type: 'message', message: progressMessage };
      }

      try {
        // Build context for this step
        const stepContext: SkillContext = {
          ...this.state.context,
          ...step.inputContext,
        };

        // Execute the skill
        const result = await this.skillsTools.executeSkill(step.skillKey, stepContext);

        if (result.success) {
          step.status = 'completed';
          step.result = result;

          // Update context with outputs
          if (result.output && typeof result.output === 'object') {
            this.state.context = { ...this.state.context, ...(result.output as object) };
          }

          this.state.executedSteps.push(step);
          yield { type: 'step_complete', step, result };
        } else {
          throw new Error(result.error || 'Skill execution failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        step.status = 'failed';
        step.error = errorMessage;
        yield { type: 'step_failed', step, error: errorMessage };

        // Continue to next step (don't abort entire plan)
        console.warn(`[Agent.runExecutePhase] Step ${step.skillKey} failed:`, errorMessage);
      }
    }
  }

  /**
   * REPORT Phase: Generate final report
   */
  private async *runReportPhase(): AsyncGenerator<AgentEvent> {
    this.setPhase('report');

    const report = this.generateReport();
    const reportMessage = this.createReportMessage(report);
    this.state.conversationHistory.push(reportMessage);

    yield { type: 'report', report };
    yield { type: 'message', message: reportMessage };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Load available skills for the organization
   */
  private async loadAvailableSkills(): Promise<Skill[]> {
    try {
      return await this.skillsProvider.listSkills(undefined, true);
    } catch (error) {
      console.error('[Agent.loadAvailableSkills] Error:', error);
      return [];
    }
  }

  /**
   * Set the current phase and emit event
   */
  private setPhase(phase: AgentPhase): void {
    this.state.phase = phase;
    this.emit({ type: 'phase_change', phase });
  }

  /**
   * Add a user message to history
   */
  private addUserMessage(content: string): void {
    const message: AgentMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'info',
      content,
      timestamp: new Date(),
    };
    this.state.conversationHistory.push(message);
  }

  /**
   * Create a message
   */
  private createMessage(type: AgentMessage['type'], content: string): AgentMessage {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
    };
  }

  /**
   * Create a plan message
   */
  private createPlanMessage(plan: ExecutionPlan): AgentMessage {
    const stepsText = plan.steps
      .map((s, i) => `${i + 1}. ${s.skill.frontmatter?.name || s.skillKey}: ${s.purpose}`)
      .join('\n');

    const gapsText =
      plan.gaps.length > 0
        ? `\n\n**Note:** ${plan.gaps.map((g) => g.capability).join(', ')} not available yet.`
        : '';

    return {
      id: `plan-${Date.now()}`,
      type: 'plan',
      content: `Here's my plan:\n\n${stepsText}${gapsText}\n\n**I can accomplish:** ${plan.canAccomplish}`,
      timestamp: new Date(),
      plan,
      gaps: plan.gaps,
    };
  }

  /**
   * Create a progress message
   */
  private createProgressMessage(step: PlannedStep, totalSteps: number): AgentMessage {
    return {
      id: `progress-${Date.now()}`,
      type: 'progress',
      content: `Running: ${step.skill.frontmatter?.name || step.skillKey}...`,
      timestamp: new Date(),
      progress: {
        skillKey: step.skillKey,
        skillName: step.skill.frontmatter?.name || step.skillKey,
        status: 'running',
        stepIndex: step.order,
        totalSteps,
      },
    };
  }

  /**
   * Create a report message
   */
  private createReportMessage(report: ExecutionReport): AgentMessage {
    const accomplishedText =
      report.accomplished.length > 0
        ? `**Done:**\n${report.accomplished.map((a) => `✓ ${a}`).join('\n')}`
        : '';

    const gapsText =
      report.gaps.length > 0
        ? `\n\n**Needs setup:**\n${report.gaps.map((g) => `⚠ ${g.capability}`).join('\n')}`
        : '';

    const nextStepsText =
      report.nextSteps.length > 0
        ? `\n\n**Next steps:**\n${report.nextSteps.map((s) => `→ ${s}`).join('\n')}`
        : '';

    return {
      id: `report-${Date.now()}`,
      type: 'report',
      content: `${accomplishedText}${gapsText}${nextStepsText}\n\n${report.summary}`,
      timestamp: new Date(),
      report,
      gaps: report.gaps,
    };
  }

  /**
   * Generate the final execution report
   */
  private generateReport(): ExecutionReport {
    const completedSteps = this.state.executedSteps.filter((s) => s.status === 'completed');
    const failedSteps = this.state.plan?.steps.filter((s) => s.status === 'failed') || [];

    const accomplished = completedSteps.map(
      (s) => s.skill.frontmatter?.name || s.skillKey
    );

    // Collect outputs
    const outputs: Record<string, unknown> = {};
    for (const step of completedSteps) {
      if (step.result?.output) {
        outputs[step.skillKey] = step.result.output;
      }
    }

    // Determine next steps
    const nextSteps: string[] = [];

    if (this.state.gaps.length > 0) {
      for (const gap of this.state.gaps) {
        if (gap.suggestion) {
          nextSteps.push(gap.suggestion);
        } else {
          nextSteps.push(`Set up ${gap.capability} to unlock this capability`);
        }
      }
    }

    if (failedSteps.length > 0) {
      nextSteps.push(`Retry failed steps: ${failedSteps.map((s) => s.skillKey).join(', ')}`);
    }

    // Generate summary
    const success = completedSteps.length > 0;
    let summary: string;

    if (success && this.state.gaps.length === 0) {
      summary = `Completed successfully! ${accomplished.length} action(s) executed.`;
    } else if (success && this.state.gaps.length > 0) {
      summary = `Partially complete. ${accomplished.length} action(s) done. ${this.state.gaps.length} capability gap(s) identified.`;
    } else if (completedSteps.length === 0 && this.state.gaps.length > 0) {
      summary = `Could not complete the request. Missing capabilities: ${this.state.gaps.map((g) => g.capability).join(', ')}`;
    } else {
      summary = `No actions were executed. Please try a different request.`;
    }

    return {
      accomplished,
      outputs,
      gaps: this.state.gaps,
      nextSteps,
      success,
      summary,
    };
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: AgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[Agent.emit] Handler error:', error);
      }
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new AutonomousAgent
 */
export function createAutonomousAgent(config: AgentConfig): AutonomousAgent {
  return new AutonomousAgent(config);
}
