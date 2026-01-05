/**
 * useAutonomousAgent Hook
 *
 * React hook that integrates the autonomous agent with the existing Copilot UI.
 * Converts agent events to CopilotMessage format for seamless UI integration.
 *
 * @example
 * ```typescript
 * const {
 *   messages,
 *   isProcessing,
 *   currentQuestion,
 *   sendMessage,
 *   respondToQuestion,
 *   reset
 * } = useAutonomousAgent({ organizationId, userId });
 *
 * // In UI, use messages with existing ChatMessage component
 * // When currentQuestion is set, show question UI with options
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AutonomousAgent, createAutonomousAgent } from './agent';
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  ExecutionPlan,
  ExecutionReport,
  QuestionOption,
} from './types';
import type { CopilotMessage, CopilotResponse, QuickActionResponse } from '@/components/copilot/types';

// =============================================================================
// Types
// =============================================================================

export interface UseAutonomousAgentOptions extends Omit<AgentConfig, 'organizationId' | 'userId'> {
  organizationId: string;
  userId: string;
  /** Callback when agent completes */
  onComplete?: (report: ExecutionReport) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface AutonomousAgentState {
  /** Messages formatted for CopilotMessage component */
  messages: CopilotMessage[];
  /** Whether the agent is processing */
  isProcessing: boolean;
  /** Current question awaiting response */
  currentQuestion: {
    messageId: string;
    question: string;
    options?: QuestionOption[];
  } | null;
  /** Current execution plan (if in plan/execute phase) */
  currentPlan: ExecutionPlan | null;
  /** Final report (if completed) */
  report: ExecutionReport | null;
  /** Error if any */
  error: string | null;
}

export interface UseAutonomousAgentReturn extends AutonomousAgentState {
  /** Send a message to start/continue the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Respond to a question */
  respondToQuestion: (response: string | string[]) => Promise<void>;
  /** Reset the agent */
  reset: () => void;
  /** Get the raw agent instance */
  getAgent: () => AutonomousAgent | null;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert AgentMessage to CopilotMessage
 */
function agentToCopilotMessage(agentMsg: AgentMessage): CopilotMessage {
  const base: CopilotMessage = {
    id: agentMsg.id,
    role: 'assistant',
    content: agentMsg.content,
    timestamp: agentMsg.timestamp,
  };

  // Convert based on message type
  switch (agentMsg.type) {
    case 'question':
      // Questions show as regular text with the question
      return {
        ...base,
        content: agentMsg.content,
        // Store options in recommendations for UI to display
        recommendations: agentMsg.options?.map((opt, idx) => ({
          id: `option-${idx}`,
          priority: idx + 1,
          title: opt.label,
          description: opt.description || '',
          actions: [{
            id: `select-${idx}`,
            label: opt.label,
            type: 'custom' as const,
            variant: 'primary' as const,
          }],
          tags: [],
        })),
      };

    case 'plan':
      // Show plan as structured response
      return {
        ...base,
        structuredResponse: createPlanResponse(agentMsg),
      };

    case 'progress':
      // Progress shows as info message
      return {
        ...base,
        content: agentMsg.content,
      };

    case 'report':
      // Report shows as structured response
      return {
        ...base,
        structuredResponse: createReportResponse(agentMsg),
      };

    case 'error':
      return {
        ...base,
        content: `⚠️ ${agentMsg.content}`,
      };

    default:
      return base;
  }
}

/**
 * Create a structured response for a plan
 */
function createPlanResponse(agentMsg: AgentMessage): CopilotResponse {
  const plan = agentMsg.plan;

  if (!plan) {
    return {
      type: 'workflow_process',
      summary: agentMsg.content,
      data: {
        process: { name: 'Execution Plan', type: 'task' },
        currentStep: { id: '0', name: 'Planning', stage: 'planning', averageTime: 0, itemsInStage: 0, averageAge: 0 },
        nextSteps: [],
        stuckItems: [],
        bottlenecks: [],
        recommendations: [],
      },
      actions: [],
    };
  }

  return {
    type: 'workflow_process',
    summary: `Plan to accomplish: ${plan.goal.goalStatement}`,
    data: {
      process: {
        name: 'Execution Plan',
        type: 'task',
        description: plan.canAccomplish,
      },
      currentStep: {
        id: '0',
        name: 'Ready to execute',
        stage: 'ready',
        averageTime: 0,
        itemsInStage: plan.steps.length,
        averageAge: 0,
      },
      nextSteps: plan.steps.map((step, idx) => ({
        id: String(idx),
        name: step.skill.frontmatter?.name || step.skillKey,
        stage: step.status,
        description: step.purpose,
        averageTime: 5,
        itemsInStage: 1,
        averageAge: 0,
      })),
      stuckItems: [],
      bottlenecks: plan.gaps.map((gap) => ({
        stage: 'gap',
        issue: gap.capability,
        impact: 'medium' as const,
        itemsAffected: 1,
        recommendation: gap.suggestion || gap.requirement,
      })),
      recommendations: plan.limitations,
    },
    actions: [
      {
        id: 'execute',
        label: 'Execute Plan',
        type: 'primary',
        callback: 'agent:execute',
      },
    ],
  };
}

/**
 * Create a structured response for a report
 */
function createReportResponse(agentMsg: AgentMessage): CopilotResponse {
  const report = agentMsg.report;

  if (!report) {
    return {
      type: 'action_summary',
      summary: agentMsg.content,
      data: {
        actionsCompleted: 0,
        actionItems: [],
        metrics: {
          dealsUpdated: 0,
          clientsUpdated: 0,
          contactsUpdated: 0,
          tasksCreated: 0,
          activitiesCreated: 0,
        },
      },
      actions: [],
    };
  }

  return {
    type: 'action_summary',
    summary: report.summary,
    data: {
      actionsCompleted: report.accomplished.length,
      actionItems: report.accomplished.map((action, idx) => ({
        entityType: 'skill',
        operation: 'executed',
        entityName: action,
        success: true,
      })),
      metrics: {
        dealsUpdated: 0,
        clientsUpdated: 0,
        contactsUpdated: 0,
        tasksCreated: 0,
        activitiesCreated: 0,
      },
    },
    actions: report.nextSteps.map((step, idx) => ({
      id: `next-${idx}`,
      label: step,
      type: 'secondary' as const,
      callback: 'agent:next-step',
    })),
    metadata: {
      gaps: report.gaps,
      outputs: report.outputs,
    },
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useAutonomousAgent - React hook for autonomous agent integration
 */
export function useAutonomousAgent(
  options: UseAutonomousAgentOptions
): UseAutonomousAgentReturn {
  const { organizationId, userId, onComplete, onError, ...agentOptions } = options;

  // State
  const [state, setState] = useState<AutonomousAgentState>({
    messages: [],
    isProcessing: false,
    currentQuestion: null,
    currentPlan: null,
    report: null,
    error: null,
  });

  // Agent ref (created lazily)
  const agentRef = useRef<AutonomousAgent | null>(null);

  // Generator ref for async iteration
  const generatorRef = useRef<AsyncGenerator<AgentEvent> | null>(null);

  /**
   * Get or create the agent instance
   */
  const getAgent = useCallback(() => {
    if (!agentRef.current) {
      agentRef.current = createAutonomousAgent({
        organizationId,
        userId,
        ...agentOptions,
      });
    }
    return agentRef.current;
  }, [organizationId, userId, agentOptions]);

  /**
   * Process agent events
   */
  const processEvents = useCallback(
    async (generator: AsyncGenerator<AgentEvent>) => {
      generatorRef.current = generator;

      try {
        for await (const event of generator) {
          // Check if we should stop
          if (generatorRef.current !== generator) {
            break;
          }

          switch (event.type) {
            case 'phase_change':
              // Could update UI to show current phase
              break;

            case 'message':
              setState((prev) => ({
                ...prev,
                messages: [...prev.messages, agentToCopilotMessage(event.message)],
              }));
              break;

            case 'question':
              setState((prev) => ({
                ...prev,
                messages: [...prev.messages, agentToCopilotMessage(event.message)],
                currentQuestion: {
                  messageId: event.message.id,
                  question: event.message.content,
                  options: event.message.options,
                },
                isProcessing: false, // Pause processing while waiting for response
              }));
              return; // Stop processing until user responds

            case 'plan_created':
              setState((prev) => ({
                ...prev,
                currentPlan: event.plan,
              }));
              break;

            case 'step_start':
              // Could show progress indicator
              break;

            case 'step_complete':
            case 'step_failed':
              // Could update step status in UI
              break;

            case 'report':
              setState((prev) => ({
                ...prev,
                report: event.report,
              }));
              onComplete?.(event.report);
              break;

            case 'error':
              setState((prev) => ({
                ...prev,
                error: event.error,
                isProcessing: false,
              }));
              onError?.(event.error);
              return;

            case 'complete':
              setState((prev) => ({
                ...prev,
                isProcessing: false,
              }));
              return;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isProcessing: false,
        }));
        onError?.(errorMessage);
      }
    },
    [onComplete, onError]
  );

  /**
   * Send a message to start/continue the agent
   */
  const sendMessage = useCallback(
    async (message: string) => {
      const agent = getAgent();

      // Add user message to state
      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isProcessing: true,
        error: null,
        currentQuestion: null,
      }));

      // Run the agent
      const generator = agent.run(message);
      await processEvents(generator);
    },
    [getAgent, processEvents]
  );

  /**
   * Respond to a question from the agent
   */
  const respondToQuestion = useCallback(
    async (response: string | string[]) => {
      const agent = getAgent();
      const { currentQuestion } = state;

      if (!currentQuestion) {
        console.warn('[useAutonomousAgent] No question to respond to');
        return;
      }

      const responseText = Array.isArray(response) ? response.join(', ') : response;

      // Add user response to messages
      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: responseText,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isProcessing: true,
        currentQuestion: null,
      }));

      // Continue the agent with the response
      const generator = agent.respond(currentQuestion.messageId, response);
      await processEvents(generator);
    },
    [getAgent, state.currentQuestion, processEvents]
  );

  /**
   * Reset the agent
   */
  const reset = useCallback(() => {
    // Stop any running generator
    generatorRef.current = null;

    // Reset agent
    if (agentRef.current) {
      agentRef.current.reset();
    }

    // Reset state
    setState({
      messages: [],
      isProcessing: false,
      currentQuestion: null,
      currentPlan: null,
      report: null,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      generatorRef.current = null;
    };
  }, []);

  return {
    ...state,
    sendMessage,
    respondToQuestion,
    reset,
    getAgent: () => agentRef.current,
  };
}

export default useAutonomousAgent;
