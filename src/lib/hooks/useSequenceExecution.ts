/**
 * useSequenceExecution Hook
 *
 * React hook for executing agent sequences with mock or live data.
 * Tracks step-by-step execution progress with real-time updates.
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/clientV2';
import type {
  AgentSequence,
  SequenceExecution,
  StepResult,
  SequenceStep,
  HITLConfig,
  HITLRequest,
} from './useAgentSequences';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';

// =============================================================================
// Types
// =============================================================================

export interface ExecutionOptions {
  /** Use mock data instead of live execution */
  isSimulation: boolean;
  /** Mock data to use for simulation */
  mockData?: Record<string, unknown>;
  /** Initial input context */
  inputContext: Record<string, unknown>;
  /** Callback for step progress updates */
  onStepStart?: (stepIndex: number, step: SequenceStep) => void;
  onStepComplete?: (stepIndex: number, result: StepResult) => void;
  onStepFailed?: (stepIndex: number, error: string) => void;
  /** HITL callbacks */
  onHITLRequest?: (request: HITLRequest) => void;
  onHITLResponse?: (request: HITLRequest, response: string) => void;
  /** Whether to skip HITL in simulation mode */
  skipHITLInSimulation?: boolean;
}

export interface ExecutionState {
  /** Current execution ID */
  executionId: string | null;
  /** Overall execution status */
  status: SequenceExecution['status'];
  /** Results for each step */
  stepResults: StepResult[];
  /** Current step being executed */
  currentStepIndex: number;
  /** Final accumulated context */
  context: Record<string, unknown>;
  /** Error message if failed */
  error: string | null;
  /** Whether execution is in progress */
  isExecuting: boolean;
  /** Whether waiting for HITL response */
  isWaitingHITL: boolean;
  /** Current HITL request if waiting */
  currentHITLRequest: HITLRequest | null;
  /** Position of current HITL (before or after step) */
  hitlPosition: 'before' | 'after' | null;
}

// =============================================================================
// Default Mock Data
// =============================================================================

export const DEFAULT_MOCK_DATA: Record<string, unknown> = {
  // Contact data
  contact: {
    id: 'mock-contact-1',
    name: 'Jane Smith',
    email: 'jane.smith@acme.com',
    company: 'Acme Corporation',
    role: 'VP of Engineering',
    phone: '+1 (555) 123-4567',
    linkedin_url: 'https://linkedin.com/in/janesmith',
    last_contacted: '2025-12-15T10:30:00Z',
  },

  // Deal data
  deal: {
    id: 'mock-deal-1',
    name: 'Enterprise License Deal',
    stage: 'Proposal',
    value: 85000,
    probability: 60,
    expected_close_date: '2026-02-15',
    last_activity: '2025-12-28T14:00:00Z',
    days_in_stage: 12,
  },

  // Meeting data
  meeting: {
    id: 'mock-meeting-1',
    title: 'Q1 Product Roadmap Review',
    date: '2026-01-10T15:00:00Z',
    attendees: ['jane.smith@acme.com', 'john.doe@acme.com'],
    duration_minutes: 60,
    meeting_type: 'discovery',
    notes: 'Discuss Q1 priorities and integration timeline',
  },

  // Company data
  company: {
    id: 'mock-company-1',
    name: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Technology',
    size: '1000-5000',
    revenue: '$50M-$100M',
    founded: 2012,
    headquarters: 'San Francisco, CA',
    tech_stack: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
  },

  // Email data
  email: {
    id: 'mock-email-1',
    subject: 'Following up on our conversation',
    from: 'sales@yourcompany.com',
    to: 'jane.smith@acme.com',
    sent_at: '2025-12-20T09:00:00Z',
    opened: true,
    clicked: false,
  },

  // Task data
  task: {
    id: 'mock-task-1',
    title: 'Send proposal follow-up',
    due_date: '2026-01-05T17:00:00Z',
    priority: 'high',
    status: 'pending',
    assigned_to: 'current_user',
  },

  // Activity data
  activity: {
    id: 'mock-activity-1',
    type: 'call',
    subject: 'Discovery call',
    date: '2025-12-18T11:00:00Z',
    duration_minutes: 30,
    outcome: 'positive',
    notes: 'Great conversation, interested in our enterprise plan',
  },
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSequenceExecution() {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const queryClient = useQueryClient();

  const [state, setState] = useState<ExecutionState>({
    executionId: null,
    status: 'pending',
    stepResults: [],
    currentStepIndex: -1,
    context: {},
    error: null,
    isExecuting: false,
    isWaitingHITL: false,
    currentHITLRequest: null,
    hitlPosition: null,
  });

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Reset execution state
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      executionId: null,
      status: 'pending',
      stepResults: [],
      currentStepIndex: -1,
      context: {},
      error: null,
      isExecuting: false,
      isWaitingHITL: false,
      currentHITLRequest: null,
      hitlPosition: null,
    });
  }, []);

  /**
   * Execute a single step
   */
  const executeStep = useCallback(
    async (
      step: SequenceStep,
      context: Record<string, unknown>,
      isSimulation: boolean,
      mockData: Record<string, unknown>
    ): Promise<StepResult> => {
      const startedAt = new Date().toISOString();
      const stepIndex = step.order - 1; // Convert 1-based order to 0-based index

      try {
        // Build input by resolving variable mappings
        const input: Record<string, unknown> = {};
        for (const [targetKey, sourceExpr] of Object.entries(step.input_mapping)) {
          input[targetKey] = resolveVariable(sourceExpr, context, mockData);
        }

        let output: Record<string, unknown>;

        if (isSimulation) {
          // Simulation mode: generate mock output based on skill type
          output = generateMockOutput(step.skill_key, input, mockData);
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
        } else {
          // Live mode: call the actual skill via edge function
          const { data, error } = await supabase.functions.invoke('execute-skill', {
            body: {
              skill_key: step.skill_key,
              input,
              organization_id: activeOrg?.id,
              user_id: user?.id,
            },
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Skill execution failed');
          output = data.result || {};
        }

        const completedAt = new Date().toISOString();
        return {
          step_index: stepIndex,
          skill_key: step.skill_key,
          status: 'completed',
          input,
          output,
          error: null,
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        };
      } catch (err) {
        const completedAt = new Date().toISOString();
        return {
          step_index: stepIndex,
          skill_key: step.skill_key,
          status: 'failed',
          input: {},
          output: null,
          error: err instanceof Error ? err.message : String(err),
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        };
      }
    },
    [activeOrg?.id, user?.id]
  );

  /**
   * Create a HITL request and pause execution
   */
  const createHITLRequest = useCallback(
    async (
      executionId: string,
      sequenceKey: string,
      stepIndex: number,
      hitlConfig: HITLConfig,
      context: Record<string, unknown>,
      mockData: Record<string, unknown>
    ): Promise<HITLRequest> => {
      if (!user?.id || !activeOrg?.id) {
        throw new Error('User and organization required');
      }

      // Interpolate prompt with context variables
      const interpolatedPrompt = hitlConfig.prompt.replace(
        /\$\{([^}]+)\}/g,
        (_, path) => {
          const value = resolveVariable(`\${${path}}`, context, mockData);
          return value !== undefined ? String(value) : `\${${path}}`;
        }
      );

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + hitlConfig.timeout_minutes);

      const { data: request, error } = await supabase
        .from('hitl_requests')
        .insert({
          execution_id: executionId,
          sequence_key: sequenceKey,
          step_index: stepIndex,
          organization_id: activeOrg.id,
          requested_by_user_id: user.id,
          assigned_to_user_id: hitlConfig.assigned_to_user_id || null,
          request_type: hitlConfig.request_type,
          prompt: interpolatedPrompt,
          options: hitlConfig.options || [],
          default_value: hitlConfig.default_value || null,
          channels: hitlConfig.channels,
          slack_channel_id: hitlConfig.slack_channel_id || null,
          timeout_minutes: hitlConfig.timeout_minutes,
          timeout_action: hitlConfig.timeout_action,
          expires_at: expiresAt.toISOString(),
          execution_context: context,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Update execution to waiting state
      await supabase
        .from('sequence_executions')
        .update({
          status: 'waiting_hitl',
          waiting_for_hitl: true,
          current_hitl_request_id: request.id,
        })
        .eq('id', executionId);

      // If Slack channel is configured, trigger Slack notification
      if (hitlConfig.channels.includes('slack')) {
        // Fire and forget - don't wait for Slack
        supabase.functions
          .invoke('send-hitl-slack-notification', {
            body: {
              hitl_request_id: request.id,
              organization_id: activeOrg.id,
            },
          })
          .catch((err) => console.error('Failed to send Slack notification:', err));
      }

      return request as HITLRequest;
    },
    [user?.id, activeOrg?.id]
  );

  /**
   * Resume execution after HITL response
   */
  const resumeAfterHITL = useCallback(
    async (
      response: string,
      responseContext?: Record<string, unknown>
    ) => {
      if (!state.currentHITLRequest || !state.executionId) {
        throw new Error('No HITL request to resume from');
      }

      // Update HITL request with response
      const { data: result } = await supabase.rpc('handle_hitl_response', {
        p_request_id: state.currentHITLRequest.id,
        p_response_value: response,
        p_response_context: responseContext || {},
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to handle HITL response');
      }

      // Clear HITL waiting state
      setState((prev) => ({
        ...prev,
        isWaitingHITL: false,
        currentHITLRequest: null,
        hitlPosition: null,
        status: 'running',
      }));

      // The execution will be resumed by the caller
      return { response, context: responseContext };
    },
    [state.currentHITLRequest, state.executionId]
  );

  /**
   * Execute a full sequence
   */
  const execute = useCallback(
    async (sequence: AgentSequence, options: ExecutionOptions) => {
      if (!user?.id || !activeOrg?.id) {
        throw new Error('User and organization required');
      }

      // Reset and start
      abortControllerRef.current = new AbortController();
      const steps = sequence.frontmatter.sequence_steps;
      const mockData = { ...DEFAULT_MOCK_DATA, ...options.mockData };

      setState({
        executionId: null,
        status: 'running',
        stepResults: steps.map((step, idx) => ({
          step_index: idx,
          skill_key: step.skill_key,
          status: 'pending' as const,
          input: {},
          output: null,
          error: null,
          started_at: null,
          completed_at: null,
          duration_ms: null,
        })),
        currentStepIndex: 0,
        context: { ...options.inputContext },
        error: null,
        isExecuting: true,
        isWaitingHITL: false,
        currentHITLRequest: null,
        hitlPosition: null,
      });

      // Create execution record in database (skip for simulations to avoid requiring DB setup)
      let executionId: string;

      if (options.isSimulation) {
        // For simulations, generate a temporary ID without hitting the database
        executionId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else {
        const { data: execution, error: createError } = await supabase
          .from('sequence_executions')
          .insert({
            sequence_key: sequence.skill_key,
            organization_id: activeOrg.id,
            user_id: user.id,
            status: 'running',
            input_context: options.inputContext,
            is_simulation: false,
            mock_data_used: null,
          })
          .select()
          .single();

        if (createError) {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: createError.message,
            isExecuting: false,
          }));
          throw createError;
        }
        executionId = execution.id;
      }

      setState((prev) => ({ ...prev, executionId }));

      let context = { ...options.inputContext };
      const results: StepResult[] = [];

      // Helper to check if HITL should be triggered
      const shouldTriggerHITL = (hitlConfig: HITLConfig | undefined): boolean => {
        if (!hitlConfig?.enabled) return false;
        // Skip HITL in simulation mode if configured
        if (options.isSimulation && options.skipHITLInSimulation !== false) return false;
        return true;
      };

      // Execute each step in order
      for (let i = 0; i < steps.length; i++) {
        // Check for cancellation
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const step = steps[i];

        // Update current step
        setState((prev) => ({
          ...prev,
          currentStepIndex: i,
          stepResults: prev.stepResults.map((r, idx) =>
            idx === i ? { ...r, status: 'running' as const, started_at: new Date().toISOString() } : r
          ),
        }));

        options.onStepStart?.(i, step);

        // Check for HITL BEFORE step execution
        if (shouldTriggerHITL(step.hitl_before)) {
          const hitlRequest = await createHITLRequest(
            execution.id,
            sequence.skill_key,
            i,
            step.hitl_before!,
            context,
            mockData
          );

          // Update state to waiting for HITL
          setState((prev) => ({
            ...prev,
            status: 'waiting_hitl',
            isWaitingHITL: true,
            currentHITLRequest: hitlRequest,
            hitlPosition: 'before',
            stepResults: prev.stepResults.map((r, idx) =>
              idx === i ? { ...r, status: 'waiting_hitl' as const, hitl_request_id: hitlRequest.id } : r
            ),
          }));

          options.onHITLRequest?.(hitlRequest);

          // Return with HITL waiting status - caller must resume
          return {
            success: false,
            results,
            context,
            error: null,
            waitingHITL: true,
            hitlRequest,
            hitlPosition: 'before' as const,
            stepIndex: i,
          };
        }

        // Execute the step
        const result = await executeStep(step, context, options.isSimulation, mockData);
        results.push(result);

        if (result.status === 'completed' && result.output) {
          // Add output to context under the output_key
          context = { ...context, [step.output_key]: result.output };
        }

        // Update state with result
        setState((prev) => ({
          ...prev,
          stepResults: prev.stepResults.map((r, idx) => (idx === i ? result : r)),
          context,
        }));

        if (result.status === 'completed') {
          options.onStepComplete?.(i, result);

          // Check for HITL AFTER step execution
          if (shouldTriggerHITL(step.hitl_after)) {
            const hitlRequest = await createHITLRequest(
              execution.id,
              sequence.skill_key,
              i,
              step.hitl_after!,
              context,
              mockData
            );

            // Update state to waiting for HITL
            setState((prev) => ({
              ...prev,
              status: 'waiting_hitl',
              isWaitingHITL: true,
              currentHITLRequest: hitlRequest,
              hitlPosition: 'after',
              stepResults: prev.stepResults.map((r, idx) =>
                idx === i ? { ...r, hitl_request_id: hitlRequest.id } : r
              ),
            }));

            options.onHITLRequest?.(hitlRequest);

            // Return with HITL waiting status - caller must resume
            return {
              success: false,
              results,
              context,
              error: null,
              waitingHITL: true,
              hitlRequest,
              hitlPosition: 'after' as const,
              stepIndex: i,
            };
          }
        } else if (result.status === 'failed') {
          options.onStepFailed?.(i, result.error || 'Unknown error');

          // Handle failure based on on_failure strategy
          if (step.on_failure === 'stop') {
            // Stop execution
            setState((prev) => ({
              ...prev,
              status: 'failed',
              error: result.error,
              isExecuting: false,
            }));

            // Update database record
            await supabase
              .from('sequence_executions')
              .update({
                status: 'failed',
                step_results: results,
                error_message: result.error,
                failed_step_index: i,
                completed_at: new Date().toISOString(),
              })
              .eq('id', execution.id);

            return { success: false, results, context, error: result.error };
          }
          // If on_failure === 'continue', continue to next step
        }
      }

      // All steps completed
      const finalOutput = context;
      setState((prev) => ({
        ...prev,
        status: 'completed',
        isExecuting: false,
      }));

      // Update database record
      await supabase
        .from('sequence_executions')
        .update({
          status: 'completed',
          step_results: results,
          final_output: finalOutput,
          completed_at: new Date().toISOString(),
        })
        .eq('id', execution.id);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['agent-sequences', 'executions'] });

      return { success: true, results, context: finalOutput, error: null, waitingHITL: false };
    },
    [user?.id, activeOrg?.id, executeStep, createHITLRequest, queryClient]
  );

  /**
   * Cancel current execution
   */
  const cancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (state.executionId) {
      await supabase
        .from('sequence_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', state.executionId);
    }

    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      isExecuting: false,
    }));
  }, [state.executionId]);

  return {
    ...state,
    execute,
    cancel,
    reset,
    resumeAfterHITL,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve a variable expression like "${contact.name}" or "${step1.output}"
 */
function resolveVariable(
  expression: string,
  context: Record<string, unknown>,
  mockData: Record<string, unknown>
): unknown {
  // Check if it's a variable expression
  const match = expression.match(/^\$\{(.+)\}$/);
  if (!match) return expression;

  const path = match[1];
  const parts = path.split('.');

  // Try to resolve from context first
  let value: unknown = context;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      // Try mock data as fallback
      value = mockData;
      for (const p of parts) {
        if (value && typeof value === 'object' && p in value) {
          value = (value as Record<string, unknown>)[p];
        } else {
          return undefined;
        }
      }
      break;
    }
  }

  return value;
}

/**
 * Generate mock output based on skill type
 */
function generateMockOutput(
  skillKey: string,
  input: Record<string, unknown>,
  mockData: Record<string, unknown>
): Record<string, unknown> {
  // Match skill patterns and return appropriate mock data
  if (skillKey.includes('contact') || skillKey.includes('find-contact')) {
    return mockData.contact as Record<string, unknown>;
  }
  if (skillKey.includes('deal') || skillKey.includes('get-deal')) {
    return mockData.deal as Record<string, unknown>;
  }
  if (skillKey.includes('meeting') || skillKey.includes('get-meeting')) {
    return mockData.meeting as Record<string, unknown>;
  }
  if (skillKey.includes('company') || skillKey.includes('enrich')) {
    return mockData.company as Record<string, unknown>;
  }
  if (skillKey.includes('email') || skillKey.includes('draft')) {
    return {
      subject: `Re: ${input.subject || 'Follow-up'}`,
      body: `Hi ${(mockData.contact as Record<string, unknown>)?.name || 'there'},\n\nThank you for your time...\n\nBest regards`,
      generated_at: new Date().toISOString(),
    };
  }
  if (skillKey.includes('brief') || skillKey.includes('summary')) {
    return {
      summary: `Meeting brief for ${(mockData.contact as Record<string, unknown>)?.name || 'contact'}`,
      talking_points: [
        'Discuss current challenges',
        'Present solution overview',
        'Review timeline and next steps',
      ],
      key_insights: [
        `${(mockData.company as Record<string, unknown>)?.name || 'Company'} is in growth phase`,
        `Current deal value: $${(mockData.deal as Record<string, unknown>)?.value || 0}`,
      ],
      generated_at: new Date().toISOString(),
    };
  }

  // Default mock output
  return {
    result: 'Mock execution completed',
    input_received: input,
    timestamp: new Date().toISOString(),
  };
}

export default useSequenceExecution;
