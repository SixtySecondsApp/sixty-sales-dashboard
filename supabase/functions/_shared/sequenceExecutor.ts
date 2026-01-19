import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeAgentSkillWithContract, type SkillResult } from './agentSkillExecutor.ts';
import { executeAction, type ExecuteActionName } from './copilot_adapters/executeAction.ts';

export interface SequenceExecuteParams {
  organizationId: string;
  userId: string;
  sequenceKey: string;
  sequenceContext?: Record<string, unknown>;
  isSimulation?: boolean;
}

interface SequenceStep {
  order: number;
  skill_key?: string; // For skill execution
  action?: ExecuteActionName; // For direct action execution
  input_mapping?: Record<string, string>;
  output_key?: string;
  on_failure?: 'stop' | 'continue' | 'fallback';
  fallback_skill_key?: string;
  requires_approval?: boolean; // For write actions that need approval
}

function resolveExpression(expr: unknown, state: Record<string, unknown>): unknown {
  if (typeof expr !== 'string') return expr;

  const match = expr.match(/^\$\{(.+)\}$/);
  if (!match) return expr;

  // Normalize array indices: foo[0].bar -> foo.0.bar
  const normalized = match[1].replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.').filter(Boolean);

  let value: any = state;
  for (const key of parts) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object') return undefined;
    value = (value as any)[key];
  }
  return value;
}

function buildStepInput(step: SequenceStep, state: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const mapping = step.input_mapping || {};
  for (const [targetKey, sourceExpr] of Object.entries(mapping)) {
    const val = resolveExpression(sourceExpr, state);
    if (val !== undefined) input[targetKey] = val;
  }
  // Provide minimal sequence metadata (avoid circular references / large payloads)
  const execution = (state.execution && typeof state.execution === 'object') ? state.execution : {};
  input._sequence = {
    execution_id: (execution as any).id,
    sequence_key: (execution as any).sequence_key,
  };
  return input;
}

export async function executeSequence(
  supabase: SupabaseClient,
  params: SequenceExecuteParams
): Promise<{
  success: boolean;
  execution_id: string;
  sequence_key: string;
  organization_id: string;
  status: 'completed' | 'failed';
  is_simulation: boolean;
  step_results: any[];
  final_output: Record<string, unknown>;
  error: string | null;
}> {
  const organizationId = String(params.organizationId || '').trim();
  const userId = String(params.userId || '').trim();
  const sequenceKey = String(params.sequenceKey || '').trim();
  const sequenceContext = (params.sequenceContext || {}) as Record<string, unknown>;
  const isSimulation = params.isSimulation === true;

  if (!organizationId) throw new Error('organizationId is required');
  if (!userId) throw new Error('userId is required');
  if (!sequenceKey) throw new Error('sequenceKey is required');

  // Authorization: user must be a member of the organization
  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('org_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error('Access denied to this organization');
  }

  // Load the sequence definition from organization_skills (enabled) + platform_skills
  const { data: row, error: rowError } = await supabase
    .from('organization_skills')
    .select(
      `
      skill_id,
      is_enabled,
      compiled_frontmatter,
      platform_skills:platform_skill_id(category, frontmatter, is_active)
    `
    )
    .eq('organization_id', organizationId)
    .eq('skill_id', sequenceKey)
    .eq('is_active', true)
    .maybeSingle();

  if (rowError) throw new Error(`Failed to load sequence: ${rowError.message}`);
  if (!row || row.is_enabled !== true) throw new Error('Sequence not found or not enabled');
  if ((row.platform_skills?.is_active ?? true) !== true) throw new Error('Sequence is not active');
  if (row.platform_skills?.category !== 'agent-sequence') {
    throw new Error('Provided sequenceKey is not an agent-sequence');
  }

  const frontmatter = (row.compiled_frontmatter || row.platform_skills?.frontmatter || {}) as Record<
    string,
    any
  >;
  const stepsRaw = frontmatter.sequence_steps;
  const steps: SequenceStep[] = Array.isArray(stepsRaw) ? (stepsRaw as SequenceStep[]) : [];
  if (steps.length === 0) throw new Error('Sequence has no steps configured');

  // Create execution record
  const startedAt = new Date().toISOString();
  const { data: execution, error: execError } = await supabase
    .from('sequence_executions')
    .insert({
      sequence_key: sequenceKey,
      organization_id: organizationId,
      user_id: userId,
      status: 'running',
      input_context: sequenceContext,
      step_results: [],
      is_simulation: isSimulation,
      started_at: startedAt,
    })
    .select('id')
    .single();

  if (execError || !execution) {
    throw new Error(`Failed to create execution: ${execError?.message || 'unknown'}`);
  }

  const executionId = String(execution.id);

  const orderedSteps = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0));
  const stepResults: any[] = [];

  // Minimal state model for input_mapping resolution
  const state: Record<string, unknown> = {
    trigger: { params: sequenceContext },
    outputs: {},
    context: {},
    execution: { id: executionId, sequence_key: sequenceKey },
  };

  let overallStatus: 'completed' | 'failed' = 'completed';
  let failedStepIndex: number | null = null;
  let errorMessage: string | null = null;

  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i];
    const stepStart = Date.now();
    const stepStartedAt = new Date().toISOString();

    // Normalize skill_key and action - treat empty strings as undefined
    const skillKey = typeof step.skill_key === 'string' && step.skill_key.trim() ? step.skill_key.trim() : undefined;
    const actionKey = typeof step.action === 'string' && step.action.trim() ? step.action.trim() : undefined;

    console.log(`[sequenceExecutor] Step ${i + 1}:`, {
      raw_skill_key: step.skill_key,
      raw_action: step.action,
      normalized_skill_key: skillKey,
      normalized_action: actionKey,
    });

    // Validate step has either skill_key or action
    if (!skillKey && !actionKey) {
      overallStatus = 'failed';
      failedStepIndex = i;
      errorMessage = `Step ${i + 1} has neither skill_key nor action (raw values: skill_key=${JSON.stringify(step.skill_key)}, action=${JSON.stringify(step.action)})`;
      break;
    }

    const input = buildStepInput(step, state);
    let result: SkillResult;
    let stepType: 'skill' | 'action' = skillKey ? 'skill' : 'action';

    // Execute step based on type
    if (skillKey) {
      // Execute skill
      console.log(`[sequenceExecutor] Executing skill: ${skillKey}`);
      result = await executeAgentSkillWithContract(supabase, {
        organizationId,
        userId,
        skillKey,
        context: input,
        dryRun: isSimulation,
      });
    } else if (actionKey) {
      // Execute action (requires approval if requires_approval is true and not simulation)
      console.log(`[sequenceExecutor] Executing action: ${actionKey}`);
      const actionInput = { ...input };
      // Safety: simulation mode should never perform write actions (ignore confirm even if provided in mapping)
      if (isSimulation) {
        delete (actionInput as any).confirm;
      }
      if (step.requires_approval && !isSimulation) {
        // In real execution, approval would be checked here
        // For now, we'll set confirm=true if requires_approval is set
        actionInput.confirm = true;
      }

      const actionResult = await executeAction(
        supabase,
        userId,
        organizationId,
        actionKey as ExecuteActionName,
        actionInput
      );

      // In simulation, convert "needs_confirmation" into a successful dry-run with preview payload.
      // This allows sequences to complete without side effects while still returning useful outputs.
      const normalizedActionResult = (isSimulation && actionResult.needs_confirmation && actionResult.preview)
        ? { ...actionResult, success: true, data: actionResult.preview, error: undefined }
        : actionResult;

      // Convert ActionResult to SkillResult format
      result = {
        status: normalizedActionResult.success ? 'success' : 'failed',
        error: normalizedActionResult.error || undefined,
        summary: normalizedActionResult.success
          ? `Action ${actionKey} completed successfully`
          : `Action ${actionKey} failed: ${normalizedActionResult.error || 'Unknown error'}`,
        data: normalizedActionResult.data || {},
        references: [],
        meta: {
          skill_id: actionKey,
          skill_version: '1.0',
          execution_time_ms: Date.now() - stepStart,
          model: undefined,
        },
      };
    } else {
      // This shouldn't happen due to earlier validation, but keep as safety net
      throw new Error(`Step ${i + 1} has neither skill_key nor action`);
    }

    // Handle failure strategy
    if (result.status === 'failed') {
      const onFailure = step.on_failure || 'stop';
      if (onFailure === 'fallback' && step.fallback_skill_key) {
        const fallback = await executeAgentSkillWithContract(supabase, {
          organizationId,
          userId,
          skillKey: step.fallback_skill_key,
          context: input,
          dryRun: isSimulation,
        });
        // Prefer fallback result if it succeeds/partials
        if (fallback.status !== 'failed') {
          result = fallback;
        }
      }

      if (result.status === 'failed' && onFailure === 'stop') {
        overallStatus = 'failed';
        failedStepIndex = i;
        errorMessage = result.error || 'Sequence step failed';
      } else if (result.status === 'failed' && onFailure === 'continue') {
        // Continue execution, but mark step as failed
        console.warn(`Step ${i + 1} failed but continuing: ${result.error}`);
      }
    }

    const stepCompletedAt = new Date().toISOString();
    const durationMs = Date.now() - stepStart;

    stepResults.push({
      step_index: i,
      step_type: stepType,
      skill_key: skillKey || null,
      action: actionKey || null,
      status: result.status,
      // Persist a sanitized input (never store mutable orchestration state to avoid cycles)
      input: (() => {
        const copy: Record<string, unknown> = { ...input };
        // `_sequence` is helpful but not required in history; keep it small either way
        return copy;
      })(),
      output: result.data || null,
      error: result.error || null,
      started_at: stepStartedAt,
      completed_at: stepCompletedAt,
      duration_ms: durationMs,
      references: result.references || [],
      meta: result.meta || {},
      requires_approval: step.requires_approval || false,
    });

    // Update outputs/state
    if (step.output_key) {
      (state.outputs as any)[step.output_key] = result.data;
    }
    (state as any).last_result = result;

    // Persist step results progressively
    await supabase
      .from('sequence_executions')
      .update({
        step_results: stepResults,
        failed_step_index: failedStepIndex,
        error_message: errorMessage,
        status: overallStatus === 'failed' ? 'failed' : 'running',
        updated_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    if (overallStatus === 'failed') break;
  }

  const completedAt = new Date().toISOString();
  const finalOutput = {
    outputs: (state.outputs as any) || {},
    last_result: (state as any).last_result || null,
    step_results: stepResults,
  };

  await supabase
    .from('sequence_executions')
    .update({
      status: overallStatus === 'failed' ? 'failed' : 'completed',
      final_output: finalOutput,
      failed_step_index: failedStepIndex,
      error_message: errorMessage,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', executionId);

  return {
    success: overallStatus !== 'failed',
    execution_id: executionId,
    sequence_key: sequenceKey,
    organization_id: organizationId,
    status: overallStatus === 'failed' ? 'failed' : 'completed',
    is_simulation: isSimulation,
    step_results: stepResults,
    final_output: finalOutput,
    error: errorMessage,
  };
}

