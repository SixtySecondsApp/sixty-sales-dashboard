/**
 * React Hook for AI Action Item Analysis
 *
 * Provides UI-friendly interface to trigger and monitor AI analysis
 * of meeting action items
 */

import { useState, useCallback } from 'react';
import AIActionItemAnalysisService from '../services/aiActionItemAnalysisService';

interface UseAIActionItemAnalysisOptions {
  autoProcess?: boolean;
  maxItems?: number;
}

export function useAIActionItemAnalysis(options?: UseAIActionItemAnalysisOptions) {
  const { autoProcess = false, maxItems = 50 } = options || {};

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState({
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ actionItemId: string; error: string }>
  });

  /**
   * Process all pending action items with AI analysis
   */
  const processPendingItems = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      const results = await AIActionItemAnalysisService.processPendingAnalysis({
        maxItems,
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
        onError: (item, err) => {
          console.error('Error processing item:', item, err);
        }
      });

      setStats(results);
      return results;
    } catch (err) {
      console.error('Error processing pending AI analysis:', err);
      setError(err as Error);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [maxItems]);

  /**
   * Process a single action item
   */
  const processActionItem = useCallback(async (actionItemId: string) => {
    setProcessing(true);
    setError(null);

    try {
      const result = await AIActionItemAnalysisService.processActionItem(actionItemId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    } catch (err) {
      console.error('Error processing action item:', err);
      setError(err as Error);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  /**
   * Get analysis statistics
   */
  const getStats = useCallback(async () => {
    try {
      const analysisStats = await AIActionItemAnalysisService.getAnalysisStats();
      return analysisStats;
    } catch (err) {
      console.error('Error fetching analysis stats:', err);
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setProcessing(false);
    setProgress({ current: 0, total: 0 });
    setError(null);
    setStats({
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    });
  }, []);

  return {
    // State
    processing,
    progress,
    error,
    stats,

    // Actions
    processPendingItems,
    processActionItem,
    getStats,
    reset
  };
}

export default useAIActionItemAnalysis;
