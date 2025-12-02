/**
 * useWritingStyleTraining Hook
 *
 * React hook for managing the writing style training flow.
 * Handles state transitions, email selection, and style saving.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { WritingStyleTrainingService } from '@/lib/services/writingStyleTrainingService';
import type {
  TrainingState,
  TrainingStep,
  EmailPreview,
  EmailForTraining,
  ExtractedStyle,
} from '@/lib/types/writingStyle';

const initialState: TrainingState = {
  step: 'idle',
  emails: [],
  selectedIds: [],
  extractedStyle: null,
  error: null,
  progress: 0,
};

export function useWritingStyleTraining() {
  const [state, setState] = useState<TrainingState>(initialState);

  // Helper to update state
  const updateState = useCallback((updates: Partial<TrainingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Set step with progress
  const setStep = useCallback((step: TrainingStep, progress: number = 0) => {
    updateState({ step, progress, error: null });
  }, [updateState]);

  /**
   * Check if Gmail is connected
   */
  const checkGmailConnection = useCallback(async (): Promise<boolean> => {
    const result = await WritingStyleTrainingService.checkGmailConnection();
    if (!result.connected) {
      updateState({
        step: 'error',
        error: 'Gmail not connected. Please connect your Google account in Settings first.',
      });
      return false;
    }
    return true;
  }, [updateState]);

  /**
   * Start the training flow - fetch emails
   */
  const fetchEmails = useCallback(async (count: number = 20) => {
    setStep('fetching', 10);

    // Check Gmail connection first
    const connected = await checkGmailConnection();
    if (!connected) return;

    updateState({ progress: 30 });

    // Fetch emails
    const result = await WritingStyleTrainingService.fetchSentEmails(count);

    if (!result.success || !result.emails) {
      updateState({
        step: 'error',
        error: result.error || 'Failed to fetch emails',
      });
      toast.error(result.error || 'Failed to fetch emails');
      return;
    }

    if (result.emails.length < 5) {
      updateState({
        step: 'error',
        error: `Only found ${result.emails.length} valid emails. Need at least 5 for training.`,
      });
      toast.error('Not enough sent emails found. Need at least 5.');
      return;
    }

    // Convert to preview format with all selected by default
    const previews: EmailPreview[] = result.emails.map(e => ({
      id: e.id,
      subject: e.subject,
      snippet: e.snippet,
      recipient: e.recipient,
      sent_at: e.sent_at,
      selected: true,
    }));

    updateState({
      step: 'selecting',
      emails: previews,
      selectedIds: previews.map(e => e.id),
      progress: 100,
    });

    toast.success(`Found ${previews.length} emails. Select which ones to use.`);
  }, [setStep, updateState, checkGmailConnection]);

  /**
   * Toggle email selection
   */
  const toggleEmailSelection = useCallback((emailId: string) => {
    setState(prev => {
      const newSelectedIds = prev.selectedIds.includes(emailId)
        ? prev.selectedIds.filter(id => id !== emailId)
        : [...prev.selectedIds, emailId];

      const newEmails = prev.emails.map(e => ({
        ...e,
        selected: newSelectedIds.includes(e.id),
      }));

      return {
        ...prev,
        emails: newEmails,
        selectedIds: newSelectedIds,
      };
    });
  }, []);

  /**
   * Select all emails
   */
  const selectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: prev.emails.map(e => e.id),
      emails: prev.emails.map(e => ({ ...e, selected: true })),
    }));
  }, []);

  /**
   * Deselect all emails
   */
  const deselectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: [],
      emails: prev.emails.map(e => ({ ...e, selected: false })),
    }));
  }, []);

  /**
   * Analyze selected emails
   */
  const analyzeSelectedEmails = useCallback(async (
    fullEmails: EmailForTraining[]
  ) => {
    const selectedEmails = fullEmails.filter(e =>
      state.selectedIds.includes(e.id)
    );

    if (selectedEmails.length < 5) {
      toast.error('Please select at least 5 emails');
      return;
    }

    setStep('analyzing', 10);

    // Prepare emails for analysis
    const emailsForAnalysis = selectedEmails.map(e => ({
      subject: e.subject,
      body: e.body,
    }));

    updateState({ progress: 50 });

    const result = await WritingStyleTrainingService.analyzeEmails(emailsForAnalysis);

    if (!result.success || !result.style) {
      updateState({
        step: 'error',
        error: result.error || 'Failed to analyze emails',
      });
      toast.error(result.error || 'Failed to analyze writing style');
      return;
    }

    updateState({
      step: 'preview',
      extractedStyle: result.style,
      progress: 100,
    });

    toast.success('Style extracted! Review and edit before saving.');
  }, [state.selectedIds, setStep, updateState]);

  /**
   * Update the extracted style (for editing)
   */
  const updateExtractedStyle = useCallback((updates: Partial<ExtractedStyle>) => {
    setState(prev => ({
      ...prev,
      extractedStyle: prev.extractedStyle
        ? { ...prev.extractedStyle, ...updates }
        : null,
    }));
  }, []);

  /**
   * Save the style
   */
  const saveStyle = useCallback(async (
    name: string,
    setAsDefault: boolean = false
  ) => {
    if (!state.extractedStyle) {
      toast.error('No style to save');
      return false;
    }

    setStep('saving', 50);

    const style = state.extractedStyle;
    const metadata = WritingStyleTrainingService.styleToMetadata(style);

    const result = await WritingStyleTrainingService.saveStyle(
      name,
      style.tone_description,
      style.example_excerpts,
      metadata,
      {
        isDefault: setAsDefault,
        sourceEmailCount: state.selectedIds.length,
      }
    );

    if (!result.success) {
      updateState({
        step: 'preview', // Go back to preview on error
        error: result.error,
      });
      toast.error(result.error || 'Failed to save style');
      return false;
    }

    updateState({
      step: 'complete',
      progress: 100,
    });

    toast.success('Writing style saved successfully!');
    return true;
  }, [state.extractedStyle, state.selectedIds.length, setStep, updateState]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Go back one step
   */
  const goBack = useCallback(() => {
    setState(prev => {
      switch (prev.step) {
        case 'selecting':
          return initialState;
        case 'analyzing':
        case 'preview':
          return { ...prev, step: 'selecting', progress: 100 };
        case 'error':
          return initialState;
        default:
          return initialState;
      }
    });
  }, []);

  return {
    state,
    // Actions
    fetchEmails,
    toggleEmailSelection,
    selectAll,
    deselectAll,
    analyzeSelectedEmails,
    updateExtractedStyle,
    saveStyle,
    reset,
    goBack,
    // Computed
    selectedCount: state.selectedIds.length,
    canAnalyze: state.selectedIds.length >= 5,
    isLoading: ['fetching', 'analyzing', 'saving'].includes(state.step),
  };
}

export default useWritingStyleTraining;
