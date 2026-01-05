/**
 * Sequence State Manager
 *
 * Manages mutable state throughout sequence execution following Context Engineering principles.
 * The state is UPDATED, not appended - keeping context in the optimal window.
 *
 * Key responsibilities:
 * - Maintain sequence state object
 * - Merge skill results into context
 * - Track token budgets
 * - Trigger compaction when needed
 * - Persist state to database
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SequenceState,
  SequenceType,
  SequenceTrigger,
  SkillResult,
  Reference,
  ContactSummary,
  CompanySummary,
  DealSummary,
  ActionItem,
  Risk,
  Opportunity,
  DraftOutput,
  CRMUpdate,
  TokenBudget,
  ApprovalState,
} from './contextEngineering';
import {
  createInitialSequenceState,
  estimateTokens,
  compactSummary,
  CONTEXT_ENGINEERING_RULES,
  TOKEN_BUDGET_DEFAULTS,
} from './contextEngineering';

// =============================================================================
// STATE MANAGER CLASS
// =============================================================================

/**
 * SequenceStateManager - Manages mutable sequence state
 *
 * Usage:
 * ```typescript
 * const manager = new SequenceStateManager(supabase, orgId, userId);
 *
 * // Initialize a new sequence
 * const state = await manager.initialize('post_meeting_intelligence', trigger);
 *
 * // After each skill execution, merge the result
 * await manager.mergeSkillResult('transcription', skillResult);
 *
 * // Add findings as they're discovered
 * manager.addKeyFact('Prospect mentioned 90-day ROI requirement');
 * manager.addActionItem({ task: 'Send proposal', owner: 'internal', ... });
 *
 * // Get current state for next skill
 * const currentState = manager.getState();
 *
 * // Persist to database
 * await manager.persist();
 * ```
 */
export class SequenceStateManager {
  private supabase: SupabaseClient;
  private organizationId: string;
  private userId: string;
  private state: SequenceState | null = null;

  constructor(supabase: SupabaseClient, organizationId: string, userId: string) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.userId = userId;
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  /**
   * Initialize a new sequence execution
   */
  async initialize(
    sequenceId: string,
    sequenceType: SequenceType,
    trigger: SequenceTrigger,
    totalSteps: number
  ): Promise<SequenceState> {
    this.state = createInitialSequenceState(sequenceId, sequenceType, trigger);
    this.state.execution.total_steps = totalSteps;

    // Initial token budget calculation
    this.updateTokenBudget();

    // Persist initial state
    await this.persist();

    return this.state;
  }

  /**
   * Load an existing sequence state from database
   */
  async load(instanceId: string): Promise<SequenceState | null> {
    const { data, error } = await this.supabase
      .from('sequence_executions')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (error || !data) {
      console.error('[SequenceStateManager.load] Failed to load state:', error);
      return null;
    }

    // Reconstruct state from database record
    this.state = this.reconstructStateFromDb(data);
    return this.state;
  }

  // =============================================================================
  // STATE ACCESS
  // =============================================================================

  /**
   * Get current state (read-only copy)
   */
  getState(): SequenceState {
    if (!this.state) {
      throw new Error('Sequence state not initialized');
    }
    return { ...this.state };
  }

  /**
   * Get compact context for skill execution
   * Returns only what the next skill needs
   */
  getSkillContext(): Record<string, unknown> {
    if (!this.state) {
      throw new Error('Sequence state not initialized');
    }

    return {
      // Sequence identity
      sequence_id: this.state.sequence_id,
      sequence_type: this.state.sequence_type,

      // Current entities
      contacts: this.state.context.entities.contacts,
      companies: this.state.context.entities.companies,
      deals: this.state.context.entities.deals,

      // Key findings (compact)
      key_facts: this.state.context.findings.key_facts.slice(0, 5),
      action_items: this.state.context.findings.action_items.slice(0, 5),
      risks: this.state.context.findings.risks.slice(0, 3),

      // References (location only, not full data)
      reference_locations: this.state.context.references.map((r) => ({
        type: r.type,
        location: r.location,
      })),
    };
  }

  // =============================================================================
  // SKILL RESULT MERGING
  // =============================================================================

  /**
   * Merge a skill result into the sequence state
   * This is the core of the mutable state pattern
   */
  async mergeSkillResult(skillId: string, result: SkillResult): Promise<void> {
    if (!this.state) {
      throw new Error('Sequence state not initialized');
    }

    // Update execution tracking
    this.state.execution.current_step++;
    this.state.execution.completed_skills.push(skillId);
    this.state.execution.pending_skills = this.state.execution.pending_skills.filter(
      (s) => s !== skillId
    );

    // Handle failed or partial skills
    if (result.status === 'failed' || result.status === 'partial') {
      this.state.execution.failed_skills.push({
        skill_id: skillId,
        error: result.error || 'Unknown error',
        recoverable: result.status === 'partial',
        attempted_at: new Date().toISOString(),
      });

      // For partial results, still continue to extract data
      if (result.status === 'failed') {
        return;
      }
    }

    // Add references (compaction: store location, not payload)
    if (result.references.length > 0) {
      this.state.context.references.push(...result.references);
    }

    // Extract and merge entities from skill data
    this.extractEntities(result.data);

    // Extract and merge findings
    this.extractFindings(result.data, result.hints);

    // Process hints for next steps
    if (result.hints?.suggested_next_skills) {
      // Could queue these for orchestrator consideration
    }

    // Update token budget
    this.updateTokenBudget();

    // Check if compaction needed
    if (this.shouldCompact()) {
      await this.compact();
    }

    // Persist updated state
    await this.persist();
  }

  // =============================================================================
  // ENTITY MANAGEMENT
  // =============================================================================

  /**
   * Add or update a contact in context
   */
  addContact(contact: ContactSummary): void {
    if (!this.state) return;

    const existing = this.state.context.entities.contacts.findIndex((c) => c.id === contact.id);
    if (existing >= 0) {
      // Update existing
      this.state.context.entities.contacts[existing] = {
        ...this.state.context.entities.contacts[existing],
        ...contact,
      };
    } else {
      this.state.context.entities.contacts.push(contact);
    }
  }

  /**
   * Add or update a company in context
   */
  addCompany(company: CompanySummary): void {
    if (!this.state) return;

    const existing = this.state.context.entities.companies.findIndex((c) => c.id === company.id);
    if (existing >= 0) {
      this.state.context.entities.companies[existing] = {
        ...this.state.context.entities.companies[existing],
        ...company,
      };
    } else {
      this.state.context.entities.companies.push(company);
    }
  }

  /**
   * Add or update a deal in context
   */
  addDeal(deal: DealSummary): void {
    if (!this.state) return;

    const existing = this.state.context.entities.deals.findIndex((d) => d.id === deal.id);
    if (existing >= 0) {
      this.state.context.entities.deals[existing] = {
        ...this.state.context.entities.deals[existing],
        ...deal,
      };
    } else {
      this.state.context.entities.deals.push(deal);
    }
  }

  // =============================================================================
  // FINDINGS MANAGEMENT
  // =============================================================================

  /**
   * Add a key fact to findings
   */
  addKeyFact(fact: string): void {
    if (!this.state) return;

    // Avoid duplicates
    if (this.state.context.findings.key_facts.includes(fact)) return;

    // Enforce limit
    if (
      this.state.context.findings.key_facts.length >= CONTEXT_ENGINEERING_RULES.MAX_KEY_FACTS
    ) {
      // Remove oldest fact
      this.state.context.findings.key_facts.shift();
    }

    this.state.context.findings.key_facts.push(fact);
  }

  /**
   * Add an action item
   */
  addActionItem(item: ActionItem): void {
    if (!this.state) return;

    // Avoid duplicates by task
    const exists = this.state.context.findings.action_items.some(
      (a) => a.task.toLowerCase() === item.task.toLowerCase()
    );
    if (exists) return;

    // Enforce limit
    if (
      this.state.context.findings.action_items.length >= CONTEXT_ENGINEERING_RULES.MAX_ACTION_ITEMS
    ) {
      // Remove completed or lowest priority
      const completedIdx = this.state.context.findings.action_items.findIndex(
        (a) => a.status === 'completed'
      );
      if (completedIdx >= 0) {
        this.state.context.findings.action_items.splice(completedIdx, 1);
      } else {
        // Remove lowest priority
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        this.state.context.findings.action_items.sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        );
        this.state.context.findings.action_items.shift();
      }
    }

    this.state.context.findings.action_items.push(item);
  }

  /**
   * Add a risk
   */
  addRisk(risk: Risk): void {
    if (!this.state) return;

    // Avoid duplicates
    const exists = this.state.context.findings.risks.some(
      (r) => r.type === risk.type && r.description === risk.description
    );
    if (exists) return;

    // Enforce limit - keep highest severity
    if (this.state.context.findings.risks.length >= CONTEXT_ENGINEERING_RULES.MAX_RISKS) {
      const severityOrder = { low: 0, medium: 1, high: 2 };
      this.state.context.findings.risks.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );
      this.state.context.findings.risks.shift();
    }

    this.state.context.findings.risks.push(risk);
  }

  /**
   * Add an opportunity
   */
  addOpportunity(opp: Opportunity): void {
    if (!this.state) return;

    // Avoid duplicates
    const exists = this.state.context.findings.opportunities.some(
      (o) => o.type === opp.type && o.description === opp.description
    );
    if (exists) return;

    // Enforce limit - keep highest value
    if (
      this.state.context.findings.opportunities.length >= CONTEXT_ENGINEERING_RULES.MAX_OPPORTUNITIES
    ) {
      this.state.context.findings.opportunities.sort(
        (a, b) => (a.potential_value || 0) - (b.potential_value || 0)
      );
      this.state.context.findings.opportunities.shift();
    }

    this.state.context.findings.opportunities.push(opp);
  }

  // =============================================================================
  // OUTPUT MANAGEMENT
  // =============================================================================

  /**
   * Add a draft output
   */
  addDraft(draft: DraftOutput): void {
    if (!this.state) return;
    this.state.outputs.drafts.push(draft);
  }

  /**
   * Add a CRM update
   */
  addCRMUpdate(update: CRMUpdate): void {
    if (!this.state) return;
    this.state.outputs.crm_updates.push(update);
  }

  /**
   * Update CRM update status
   */
  updateCRMStatus(entityId: string, status: CRMUpdate['status']): void {
    if (!this.state) return;

    const update = this.state.outputs.crm_updates.find((u) => u.entity_id === entityId);
    if (update) {
      update.status = status;
    }
  }

  // =============================================================================
  // APPROVAL MANAGEMENT
  // =============================================================================

  /**
   * Set approval as required
   */
  requireApproval(channel: 'slack' | 'email' | 'app'): void {
    if (!this.state) return;

    this.state.approval = {
      required: true,
      status: 'pending',
      requested_at: new Date().toISOString(),
      channel,
    };
  }

  /**
   * Record approval response
   */
  recordApproval(
    status: 'approved' | 'rejected' | 'modified',
    modifications?: string
  ): void {
    if (!this.state) return;

    this.state.approval.status = status;
    this.state.approval.responded_at = new Date().toISOString();
    if (modifications) {
      this.state.approval.modifications = modifications;
    }
  }

  // =============================================================================
  // TOKEN BUDGET MANAGEMENT
  // =============================================================================

  /**
   * Update token budget calculations
   */
  private updateTokenBudget(): void {
    if (!this.state) return;

    const stateTokens = estimateTokens(this.state.context);
    const resultTokens = this.state.execution.completed_skills.length * 300; // Estimate

    this.state.token_budget = {
      ...TOKEN_BUDGET_DEFAULTS,
      state_tokens: stateTokens,
      skill_result_tokens: resultTokens,
      total_used:
        CONTEXT_ENGINEERING_RULES.TOKEN_BUDGETS.system_prompt + stateTokens + resultTokens,
      over_budget:
        stateTokens > CONTEXT_ENGINEERING_RULES.TOKEN_BUDGETS.sequence_state * 2,
      warnings: this.generateTokenWarnings(stateTokens),
    };
  }

  /**
   * Generate warnings for token budget issues
   */
  private generateTokenWarnings(stateTokens: number): string[] {
    const warnings: string[] = [];

    if (stateTokens > CONTEXT_ENGINEERING_RULES.TOKEN_BUDGETS.sequence_state) {
      warnings.push(
        `State tokens (${stateTokens}) exceed budget (${CONTEXT_ENGINEERING_RULES.TOKEN_BUDGETS.sequence_state})`
      );
    }

    if (
      this.state?.context.findings.key_facts.length ===
      CONTEXT_ENGINEERING_RULES.MAX_KEY_FACTS
    ) {
      warnings.push('Key facts at maximum - new facts will replace old');
    }

    if (
      this.state?.context.references.length &&
      this.state.context.references.length > CONTEXT_ENGINEERING_RULES.COMPACT_WHEN.references_exceed
    ) {
      warnings.push('High number of references - consider compaction');
    }

    return warnings;
  }

  // =============================================================================
  // COMPACTION
  // =============================================================================

  /**
   * Check if compaction is needed
   */
  private shouldCompact(): boolean {
    if (!this.state) return false;

    return (
      this.state.token_budget.over_budget ||
      this.state.context.references.length >
        CONTEXT_ENGINEERING_RULES.COMPACT_WHEN.references_exceed
    );
  }

  /**
   * Compact the state to reduce token usage
   * Following compaction principle: keep summaries, store details externally
   */
  private async compact(): Promise<void> {
    if (!this.state) return;

    // 1. Summarize and trim key facts
    if (
      this.state.context.findings.key_facts.length > CONTEXT_ENGINEERING_RULES.MAX_KEY_FACTS
    ) {
      // Keep most recent
      this.state.context.findings.key_facts = this.state.context.findings.key_facts.slice(
        -CONTEXT_ENGINEERING_RULES.MAX_KEY_FACTS
      );
    }

    // 2. Archive old references to database, keep only recent
    if (
      this.state.context.references.length >
      CONTEXT_ENGINEERING_RULES.COMPACT_WHEN.references_exceed
    ) {
      const toArchive = this.state.context.references.slice(
        0,
        -CONTEXT_ENGINEERING_RULES.COMPACT_WHEN.references_exceed
      );

      // Store archived references in database
      await this.archiveReferences(toArchive);

      // Keep only recent references
      this.state.context.references = this.state.context.references.slice(
        -CONTEXT_ENGINEERING_RULES.COMPACT_WHEN.references_exceed
      );
    }

    // 3. Remove completed action items older than current execution
    this.state.context.findings.action_items =
      this.state.context.findings.action_items.filter((a) => a.status !== 'completed');

    // 4. Recalculate token budget
    this.updateTokenBudget();

    console.log('[SequenceStateManager.compact] State compacted', {
      key_facts: this.state.context.findings.key_facts.length,
      references: this.state.context.references.length,
      tokens: this.state.token_budget.state_tokens,
    });
  }

  /**
   * Archive references to database
   */
  private async archiveReferences(references: Reference[]): Promise<void> {
    if (!this.state || references.length === 0) return;

    const records = references.map((ref) => ({
      sequence_instance_id: this.state!.instance_id,
      organization_id: this.organizationId,
      reference_type: ref.type,
      location: ref.location,
      summary: ref.summary,
      size_bytes: ref.size_bytes,
      archived_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase.from('sequence_references_archive').insert(records);

    if (error) {
      console.error('[SequenceStateManager.archiveReferences] Failed to archive:', error);
    }
  }

  // =============================================================================
  // PERSISTENCE
  // =============================================================================

  /**
   * Persist current state to database
   */
  async persist(): Promise<void> {
    if (!this.state) return;

    const dbRecord = {
      id: this.state.instance_id,
      sequence_key: this.state.sequence_id,
      organization_id: this.organizationId,
      user_id: this.userId,
      status: this.getDbStatus(),
      input_context: this.state.trigger.params,
      step_results: this.buildStepResults(),
      final_output:
        this.state.execution.current_step >= this.state.execution.total_steps
          ? {
              findings: this.state.context.findings,
              outputs: this.state.outputs,
            }
          : null,
      error_message:
        this.state.execution.failed_skills.length > 0
          ? this.state.execution.failed_skills[
              this.state.execution.failed_skills.length - 1
            ].error
          : null,
      failed_step_index:
        this.state.execution.failed_skills.length > 0
          ? this.state.execution.current_step
          : null,
      is_simulation: false,
      waiting_for_hitl: this.state.approval.status === 'pending',
      started_at: this.state.execution.started_at,
      completed_at:
        this.state.execution.current_step >= this.state.execution.total_steps
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('sequence_executions')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.error('[SequenceStateManager.persist] Failed to persist state:', error);
    }
  }

  /**
   * Get database status from current state
   */
  private getDbStatus(): string {
    if (!this.state) return 'pending';

    if (this.state.approval.status === 'pending') return 'waiting_hitl';
    if (this.state.execution.failed_skills.some((f) => !f.recoverable)) return 'failed';
    if (this.state.execution.current_step >= this.state.execution.total_steps)
      return 'completed';
    if (this.state.execution.current_step > 0) return 'running';

    return 'pending';
  }

  /**
   * Build step results array for database
   */
  private buildStepResults(): Array<Record<string, unknown>> {
    if (!this.state) return [];

    return this.state.execution.completed_skills.map((skillId, index) => {
      const failed = this.state!.execution.failed_skills.find((f) => f.skill_id === skillId);

      return {
        step_index: index,
        skill_key: skillId,
        status: failed ? 'failed' : 'completed',
        error: failed?.error || null,
        completed_at: new Date().toISOString(),
      };
    });
  }

  // =============================================================================
  // ENTITY EXTRACTION
  // =============================================================================

  /**
   * Extract entities from skill result data
   */
  private extractEntities(data: Record<string, unknown>): void {
    // Extract contacts
    if (data.contacts && Array.isArray(data.contacts)) {
      for (const contact of data.contacts) {
        if (this.isContactSummary(contact)) {
          this.addContact(contact);
        }
      }
    }

    if (data.speakers && Array.isArray(data.speakers)) {
      for (const speaker of data.speakers) {
        if (speaker.name && speaker.role) {
          this.addContact({
            id: `speaker-${speaker.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: speaker.name,
            role: speaker.role,
            company: (data.company as string) || 'Unknown',
          });
        }
      }
    }

    // Extract company
    if (data.company && typeof data.company === 'object') {
      const company = data.company as Record<string, unknown>;
      if (company.name) {
        this.addCompany({
          id: (company.id as string) || `company-${Date.now()}`,
          name: company.name as string,
          size: (company.employee_count as number) || 0,
          industry: (company.industry as string) || 'Unknown',
          icp_score: (company.icp_score as number) || 0,
          key_signals: (company.key_signals as string[]) || [],
        });
      }
    }

    // Extract deal
    if (data.deal && typeof data.deal === 'object') {
      const deal = data.deal as Record<string, unknown>;
      if (deal.name) {
        this.addDeal({
          id: (deal.id as string) || `deal-${Date.now()}`,
          name: deal.name as string,
          value: (deal.value as number) || 0,
          stage: (deal.stage as string) || 'Unknown',
          days_in_stage: (deal.days_in_stage as number) || 0,
          health: (deal.health as DealSummary['health']) || 'on_track',
        });
      }
    }
  }

  /**
   * Extract findings from skill result data
   */
  private extractFindings(data: Record<string, unknown>, hints?: SkillResult['hints']): void {
    // Extract key quotes as facts
    if (data.key_quotes && Array.isArray(data.key_quotes)) {
      for (const quote of data.key_quotes) {
        if (typeof quote === 'string') {
          this.addKeyFact(quote);
        } else if (quote.text) {
          this.addKeyFact(`${quote.speaker || 'Unknown'}: "${quote.text}"`);
        }
      }
    }

    // Extract action items
    if (data.action_items && Array.isArray(data.action_items)) {
      for (const item of data.action_items) {
        if (item.task) {
          this.addActionItem({
            task: item.task,
            owner: item.owner || 'internal',
            due: item.due || 'asap',
            priority: item.priority || 'medium',
            status: 'pending',
          });
        }
      }
    }

    // Extract objections as risks
    if (data.objections && Array.isArray(data.objections)) {
      for (const obj of data.objections) {
        this.addRisk({
          type: 'objection',
          description: obj.objection || obj.description || String(obj),
          severity: obj.severity || 'medium',
          mitigation: obj.mitigation,
        });
      }
    }

    // Process hints flags
    if (hints?.flags) {
      for (const flag of hints.flags) {
        switch (flag) {
          case 'competitor_mentioned':
            this.addRisk({
              type: 'competitor',
              description: 'Competitor mentioned in conversation',
              severity: 'medium',
            });
            break;
          case 'high_value':
            this.addOpportunity({
              type: 'high_value',
              description: 'High value opportunity identified',
            });
            break;
          case 'expansion_opportunity':
            this.addOpportunity({
              type: 'expansion',
              description: 'Expansion opportunity identified',
            });
            break;
        }
      }
    }
  }

  /**
   * Type guard for ContactSummary
   */
  private isContactSummary(obj: unknown): obj is ContactSummary {
    if (!obj || typeof obj !== 'object') return false;
    const c = obj as Record<string, unknown>;
    return typeof c.id === 'string' && typeof c.name === 'string';
  }

  /**
   * Reconstruct state from database record
   */
  private reconstructStateFromDb(data: Record<string, unknown>): SequenceState {
    return createInitialSequenceState(
      data.sequence_key as string,
      (data.sequence_type as SequenceType) || 'custom',
      {
        type: 'database_load',
        timestamp: data.started_at as string,
        source: 'database',
        params: (data.input_context as Record<string, unknown>) || {},
      }
    );
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new SequenceStateManager
 */
export function createSequenceStateManager(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): SequenceStateManager {
  return new SequenceStateManager(supabase, organizationId, userId);
}
