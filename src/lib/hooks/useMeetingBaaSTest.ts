/**
 * useMeetingBaaSTest Hook
 *
 * Orchestrates the MeetingBaaS E2E test flow:
 * 1. Verify Google Integration
 * 2. Connect Calendar (via MeetingBaaS)
 * 3. Deploy Test Bot
 * 4. Simulate webhook: Bot Joining
 * 5. Simulate webhook: Bot Recording
 * 6. Simulate webhook: Bot Completed
 * 7. Verify Recording Ready
 *
 * Supports both Mock (simulated) and Live (real API) modes.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { MeetingBaaSMock, createMeetingBaaSMockConfigs } from '@/lib/testing/mocks';
import { ResourceTracker } from '@/lib/testing/tracking';
import { CleanupService } from '@/lib/testing/cleanup';
import { type TrackedResource, type CleanupResult } from '@/lib/types/processMapTesting';

// =============================================================================
// Types
// =============================================================================

export type TestStep =
  | 'verify_google'
  | 'connect_calendar'
  | 'deploy_bot'
  | 'webhook_joining'
  | 'webhook_recording'
  | 'webhook_completed'
  | 'recording_ready';

export type TestMode = 'mock' | 'live';

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface StepResult {
  step: TestStep;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: string;
  viewUrl?: string;
}

export interface MeetingBaaSTestState {
  mode: TestMode;
  isRunning: boolean;
  currentStep: TestStep | null;
  steps: StepResult[];
  botId: string | null;
  recordingId: string | null;
  calendarId: string | null;
  trackedResources: TrackedResource[];
  cleanupResult: CleanupResult | null;
  error: string | null;
}

export interface MeetingBaaSTestActions {
  startTest: (mode: TestMode) => Promise<void>;
  stopTest: () => void;
  cleanup: () => Promise<CleanupResult>;
  reset: () => void;
}

export interface UseMeetingBaaSTestOptions {
  orgId?: string;
  onStepStart?: (step: TestStep) => void;
  onStepComplete?: (result: StepResult) => void;
  onTestComplete?: (state: MeetingBaaSTestState) => void;
  onError?: (error: Error) => void;
  stepDelayMs?: number;
}

// =============================================================================
// Step Configuration
// =============================================================================

const TEST_STEPS: { step: TestStep; name: string; description: string }[] = [
  {
    step: 'verify_google',
    name: 'Verify Google Integration',
    description: 'Check that Google Calendar integration is connected',
  },
  {
    step: 'connect_calendar',
    name: 'Connect Calendar',
    description: 'Connect calendar to MeetingBaaS for bot scheduling',
  },
  {
    step: 'deploy_bot',
    name: 'Deploy Test Bot',
    description: 'Deploy a recording bot to join a test meeting',
  },
  {
    step: 'webhook_joining',
    name: 'Bot Joining',
    description: 'Receive webhook: bot is joining the meeting',
  },
  {
    step: 'webhook_recording',
    name: 'Bot Recording',
    description: 'Receive webhook: bot is recording the meeting',
  },
  {
    step: 'webhook_completed',
    name: 'Bot Completed',
    description: 'Receive webhook: recording completed',
  },
  {
    step: 'recording_ready',
    name: 'Recording Ready',
    description: 'Verify recording is processed and accessible',
  },
];

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMeetingBaaSTest(
  options: UseMeetingBaaSTestOptions = {}
): [MeetingBaaSTestState, MeetingBaaSTestActions] {
  const { user, organization } = useAuth();
  const {
    orgId = organization?.id,
    onStepStart,
    onStepComplete,
    onTestComplete,
    onError,
    stepDelayMs = 500,
  } = options;

  // State
  const [state, setState] = useState<MeetingBaaSTestState>({
    mode: 'mock',
    isRunning: false,
    currentStep: null,
    steps: TEST_STEPS.map(s => ({ step: s.step, status: 'pending' as StepStatus })),
    botId: null,
    recordingId: null,
    calendarId: null,
    trackedResources: [],
    cleanupResult: null,
    error: null,
  });

  // Abort controller for cancellation
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Resource tracker and cleanup service
  const [resourceTracker] = useState(() => new ResourceTracker());
  const [cleanupService] = useState(() => new CleanupService(resourceTracker));

  // Delay helper
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Update step status
  const updateStep = useCallback((step: TestStep, update: Partial<StepResult>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s => (s.step === step ? { ...s, ...update } : s)),
    }));
  }, []);

  // =============================================================================
  // Step Executors
  // =============================================================================

  const executeVerifyGoogle = async (mock: MeetingBaaSMock | null): Promise<StepResult> => {
    const startedAt = new Date().toISOString();

    if (mock) {
      // Mock mode: simulate Google integration check
      await delay(300);
      return {
        step: 'verify_google',
        status: 'passed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 300,
        data: { connected: true, email: 'test@example.com' },
      };
    }

    // Live mode: check actual Google integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('id, status, email')
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .maybeSingle();

    if (error || !integration || integration.status !== 'active') {
      return {
        step: 'verify_google',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
        error: 'Google Calendar integration not connected. Please connect Google Calendar first.',
      };
    }

    return {
      step: 'verify_google',
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      data: { connected: true, email: integration.email },
    };
  };

  const executeConnectCalendar = async (
    mock: MeetingBaaSMock | null
  ): Promise<StepResult & { calendarId?: string }> => {
    const startedAt = new Date().toISOString();

    if (mock) {
      // Mock mode: generate mock calendar
      const calendar = mock.generateCalendar();
      return {
        step: 'connect_calendar',
        status: 'passed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 400,
        data: { calendarId: calendar.id, email: calendar.email },
        calendarId: calendar.id,
      };
    }

    // Live mode: call meetingbaas-connect-calendar
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return {
        step: 'connect_calendar',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: 'No active session',
      };
    }

    const { data: response, error } = await supabase.functions.invoke('meetingbaas-connect-calendar', {
      headers: { Authorization: `Bearer ${token}` },
      body: { org_id: orgId },
    });

    if (error || !response?.success) {
      return {
        step: 'connect_calendar',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: error?.message || response?.error || 'Failed to connect calendar',
      };
    }

    return {
      step: 'connect_calendar',
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      data: { calendarId: response.calendar_id },
      calendarId: response.calendar_id,
    };
  };

  const executeDeployBot = async (
    mock: MeetingBaaSMock | null,
    calendarId: string | null
  ): Promise<StepResult & { botId?: string; recordingId?: string }> => {
    const startedAt = new Date().toISOString();

    if (mock) {
      // Mock mode: generate mock bot deployment
      const deployment = mock.generateBotDeployment();
      return {
        step: 'deploy_bot',
        status: 'passed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 500,
        data: {
          botId: deployment.bot_id,
          recordingId: deployment.recording_id,
          meetingUrl: deployment.meeting_url,
        },
        botId: deployment.bot_id,
        recordingId: deployment.recording_id,
      };
    }

    // Live mode: call deploy-recording-bot
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return {
        step: 'deploy_bot',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: 'No active session',
      };
    }

    // Create a test meeting URL for bot deployment
    const testMeetingUrl = 'https://meet.google.com/test-xxx-xxxx';

    const { data: response, error } = await supabase.functions.invoke('deploy-recording-bot', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        org_id: orgId,
        meeting_url: testMeetingUrl,
        calendar_id: calendarId,
        is_test: true,
      },
    });

    if (error || !response?.success) {
      return {
        step: 'deploy_bot',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: error?.message || response?.error || 'Failed to deploy bot',
      };
    }

    // Track the resource
    resourceTracker.addResource({
      integration: 'meetingbaas',
      resourceType: 'meeting',
      stepId: 'deploy_bot',
      stepName: 'Deploy Test Bot',
      externalId: response.bot_id,
      displayName: `Test Bot ${response.bot_id}`,
      rawData: response,
    });

    return {
      step: 'deploy_bot',
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      data: {
        botId: response.bot_id,
        recordingId: response.recording_id,
      },
      botId: response.bot_id,
      recordingId: response.recording_id,
    };
  };

  const executeWebhookSimulation = async (
    mock: MeetingBaaSMock | null,
    botId: string | null,
    eventType: 'bot.joining' | 'bot.in_meeting' | 'bot.completed',
    step: TestStep
  ): Promise<StepResult> => {
    const startedAt = new Date().toISOString();

    if (!botId) {
      return {
        step,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: 'Bot ID not available',
      };
    }

    if (mock) {
      // Mock mode: generate webhook event
      const event = mock.generateWebhookEvent(eventType);
      await delay(400);
      return {
        step,
        status: 'passed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 400,
        data: { event: event.event, statusCode: event.data.status?.code },
      };
    }

    // Live mode: call webhook simulate function
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return {
        step,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: 'No active session',
      };
    }

    const { data: response, error } = await supabase.functions.invoke('meetingbaas-webhook-simulate', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        event_type: eventType,
        org_id: orgId,
        bot_id: botId,
      },
    });

    if (error || !response?.success) {
      return {
        step,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: error?.message || response?.error || `Failed to simulate ${eventType}`,
      };
    }

    return {
      step,
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      data: response,
    };
  };

  const executeVerifyRecording = async (
    mock: MeetingBaaSMock | null,
    recordingId: string | null
  ): Promise<StepResult> => {
    const startedAt = new Date().toISOString();

    if (!recordingId) {
      return {
        step: 'recording_ready',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: 'Recording ID not available',
      };
    }

    if (mock) {
      // Mock mode: generate mock recording
      const recording = mock.generateRecording();
      await delay(500);
      return {
        step: 'recording_ready',
        status: 'passed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 500,
        data: {
          recordingId: recording.id,
          status: recording.status,
          s3Url: recording.s3_url,
        },
        viewUrl: recording.s3_url || undefined,
      };
    }

    // Live mode: check recording status
    const { data: recording, error } = await supabase
      .from('recordings')
      .select('id, status, recording_s3_url')
      .eq('id', recordingId)
      .maybeSingle();

    if (error || !recording) {
      return {
        step: 'recording_ready',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        error: error?.message || 'Recording not found',
      };
    }

    const isPassed = ['processing', 'ready'].includes(recording.status);

    return {
      step: 'recording_ready',
      status: isPassed ? 'passed' : 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      data: {
        recordingId: recording.id,
        status: recording.status,
      },
      viewUrl: recording.recording_s3_url || undefined,
      error: isPassed ? undefined : `Recording status is ${recording.status}`,
    };
  };

  // =============================================================================
  // Main Test Runner
  // =============================================================================

  const startTest = useCallback(
    async (mode: TestMode) => {
      if (!orgId) {
        onError?.(new Error('Organization ID is required'));
        return;
      }

      // Create abort controller
      const controller = new AbortController();
      setAbortController(controller);

      // Initialize mock if in mock mode
      const mock = mode === 'mock' ? new MeetingBaaSMock({ preloadData: true }) : null;

      // Reset state
      setState({
        mode,
        isRunning: true,
        currentStep: null,
        steps: TEST_STEPS.map(s => ({ step: s.step, status: 'pending' })),
        botId: null,
        recordingId: null,
        calendarId: null,
        trackedResources: [],
        cleanupResult: null,
        error: null,
      });

      let botId: string | null = null;
      let recordingId: string | null = null;
      let calendarId: string | null = null;

      try {
        // Step 1: Verify Google
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'verify_google' }));
        updateStep('verify_google', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('verify_google');

        let result = await executeVerifyGoogle(mock);
        updateStep('verify_google', result);
        onStepComplete?.(result);

        if (result.status === 'failed') {
          throw new Error(result.error || 'Google verification failed');
        }

        await delay(stepDelayMs);

        // Step 2: Connect Calendar
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'connect_calendar' }));
        updateStep('connect_calendar', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('connect_calendar');

        const calendarResult = await executeConnectCalendar(mock);
        calendarId = calendarResult.calendarId || null;
        updateStep('connect_calendar', calendarResult);
        onStepComplete?.(calendarResult);
        setState(prev => ({ ...prev, calendarId }));

        if (calendarResult.status === 'failed') {
          throw new Error(calendarResult.error || 'Calendar connection failed');
        }

        await delay(stepDelayMs);

        // Step 3: Deploy Bot
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'deploy_bot' }));
        updateStep('deploy_bot', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('deploy_bot');

        const deployResult = await executeDeployBot(mock, calendarId);
        botId = deployResult.botId || null;
        recordingId = deployResult.recordingId || null;
        updateStep('deploy_bot', deployResult);
        onStepComplete?.(deployResult);
        setState(prev => ({ ...prev, botId, recordingId }));

        if (deployResult.status === 'failed') {
          throw new Error(deployResult.error || 'Bot deployment failed');
        }

        await delay(stepDelayMs);

        // Step 4: Webhook - Bot Joining
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'webhook_joining' }));
        updateStep('webhook_joining', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('webhook_joining');

        result = await executeWebhookSimulation(mock, botId, 'bot.joining', 'webhook_joining');
        updateStep('webhook_joining', result);
        onStepComplete?.(result);

        if (result.status === 'failed') {
          throw new Error(result.error || 'Webhook simulation failed');
        }

        await delay(stepDelayMs);

        // Step 5: Webhook - Bot Recording
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'webhook_recording' }));
        updateStep('webhook_recording', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('webhook_recording');

        result = await executeWebhookSimulation(mock, botId, 'bot.in_meeting', 'webhook_recording');
        updateStep('webhook_recording', result);
        onStepComplete?.(result);

        if (result.status === 'failed') {
          throw new Error(result.error || 'Webhook simulation failed');
        }

        await delay(stepDelayMs);

        // Step 6: Webhook - Bot Completed
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'webhook_completed' }));
        updateStep('webhook_completed', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('webhook_completed');

        result = await executeWebhookSimulation(mock, botId, 'bot.completed', 'webhook_completed');
        updateStep('webhook_completed', result);
        onStepComplete?.(result);

        if (result.status === 'failed') {
          throw new Error(result.error || 'Webhook simulation failed');
        }

        await delay(stepDelayMs);

        // Step 7: Verify Recording Ready
        if (controller.signal.aborted) return;
        setState(prev => ({ ...prev, currentStep: 'recording_ready' }));
        updateStep('recording_ready', { status: 'running', startedAt: new Date().toISOString() });
        onStepStart?.('recording_ready');

        result = await executeVerifyRecording(mock, recordingId);
        updateStep('recording_ready', result);
        onStepComplete?.(result);

        // Test completed
        setState(prev => {
          const finalState = {
            ...prev,
            isRunning: false,
            currentStep: null,
            trackedResources: resourceTracker.getAllResources(),
          };
          onTestComplete?.(finalState);
          return finalState;
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Test failed');
        setState(prev => ({
          ...prev,
          isRunning: false,
          currentStep: null,
          error: err.message,
          trackedResources: resourceTracker.getAllResources(),
        }));
        onError?.(err);
      }
    },
    [orgId, stepDelayMs, onStepStart, onStepComplete, onTestComplete, onError, updateStep]
  );

  const stopTest = useCallback(() => {
    abortController?.abort();
    setState(prev => ({
      ...prev,
      isRunning: false,
      currentStep: null,
    }));
  }, [abortController]);

  const cleanup = useCallback(async (): Promise<CleanupResult> => {
    if (orgId) {
      cleanupService.setOrgId(orgId);
    }

    const result = await cleanupService.cleanupAll();
    setState(prev => ({
      ...prev,
      cleanupResult: result,
      trackedResources: resourceTracker.getAllResources(),
    }));
    return result;
  }, [orgId, cleanupService, resourceTracker]);

  const reset = useCallback(() => {
    resourceTracker.reset();
    setState({
      mode: 'mock',
      isRunning: false,
      currentStep: null,
      steps: TEST_STEPS.map(s => ({ step: s.step, status: 'pending' })),
      botId: null,
      recordingId: null,
      calendarId: null,
      trackedResources: [],
      cleanupResult: null,
      error: null,
    });
  }, [resourceTracker]);

  return [
    state,
    {
      startTest,
      stopTest,
      cleanup,
      reset,
    },
  ];
}

// Export step configuration for UI
export { TEST_STEPS };
