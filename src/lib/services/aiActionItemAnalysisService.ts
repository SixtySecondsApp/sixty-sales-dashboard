/**
 * AI Action Item Analysis Service
 *
 * Processes action items to determine optimal task type and deadline
 * using Claude Haiku 4.5
 */

import { supabase } from '../supabase';

interface PendingActionItem {
  action_item_id: string;
  task_id: string;
  title: string;
  category: string | null;
  priority: string | null;
  deadline_at: string | null;
  meeting_title: string | null;
  meeting_summary: string | null;
}

interface AIAnalysisResult {
  task_type: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general';
  ideal_deadline: string;
  confidence_score: number;
  reasoning: string;
}

export class AIActionItemAnalysisService {
  /**
   * Get pending action items that need AI analysis
   */
  static async getPendingAnalysis(): Promise<PendingActionItem[]> {
    const { data, error } = await supabase.rpc('get_pending_ai_analysis');

    if (error) {
      console.error('Error fetching pending AI analysis:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Analyze a single action item with AI
   */
  static async analyzeActionItem(actionItemId: string): Promise<AIAnalysisResult> {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-action-item', {
        body: { action_item_id: actionItemId }
      });

      if (error) {
        console.error('Error calling AI analysis function:', error);
        throw error;
      }

      return data as AIAnalysisResult;
    } catch (err) {
      console.error('Error analyzing action item:', err);
      throw err;
    }
  }

  /**
   * Apply AI analysis results to a task
   */
  static async applyAnalysisToTask(
    actionItemId: string,
    analysis: AIAnalysisResult
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('apply_ai_analysis_to_task', {
        p_action_item_id: actionItemId,
        p_task_type: analysis.task_type,
        p_ideal_deadline: analysis.ideal_deadline,
        p_confidence_score: analysis.confidence_score,
        p_reasoning: analysis.reasoning
      });

      if (error) {
        console.error('Error applying AI analysis:', error);
        throw error;
      }

      return data as boolean;
    } catch (err) {
      console.error('Error applying analysis to task:', err);
      throw err;
    }
  }

  /**
   * Process all pending action items with AI analysis
   */
  static async processPendingAnalysis(options?: {
    maxItems?: number;
    onProgress?: (current: number, total: number, item: PendingActionItem) => void;
    onError?: (item: PendingActionItem, error: Error) => void;
  }): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ actionItemId: string; error: string }>;
  }> {
    const { maxItems = 50, onProgress, onError } = options || {};

    // Get pending items
    const pendingItems = await this.getPendingAnalysis();
    const itemsToProcess = pendingItems.slice(0, maxItems);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ actionItemId: string; error: string }>
    };

    // Process each item
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      results.processed++;

      if (onProgress) {
        onProgress(i + 1, itemsToProcess.length, item);
      }

      try {
        // Analyze with AI
        const analysis = await this.analyzeActionItem(item.action_item_id);

        // Apply to task
        await this.applyAnalysisToTask(item.action_item_id, analysis);

        results.succeeded++;

        console.log(`[AI Analysis] Success for action item ${item.action_item_id}:`, {
          title: item.title,
          task_type: analysis.task_type,
          deadline: analysis.ideal_deadline,
          confidence: analysis.confidence_score
        });
      } catch (err) {
        results.failed++;
        const error = err as Error;

        results.errors.push({
          actionItemId: item.action_item_id,
          error: error.message
        });

        console.error(`[AI Analysis] Failed for action item ${item.action_item_id}:`, error);

        if (onError) {
          onError(item, error);
        }
      }

      // Add small delay to avoid rate limiting
      if (i < itemsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Process a single action item end-to-end
   */
  static async processActionItem(actionItemId: string): Promise<{
    success: boolean;
    analysis?: AIAnalysisResult;
    error?: string;
  }> {
    try {
      // Analyze with AI
      const analysis = await this.analyzeActionItem(actionItemId);

      // Apply to task
      await this.applyAnalysisToTask(actionItemId, analysis);

      return {
        success: true,
        analysis
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get AI analysis statistics
   */
  static async getAnalysisStats(): Promise<{
    total_action_items: number;
    analyzed: number;
    pending: number;
    avg_confidence: number;
  }> {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select('ai_analyzed_at, ai_confidence_score, task_id');

    if (error) {
      console.error('Error fetching analysis stats:', error);
      throw error;
    }

    const total = data?.filter(item => item.task_id !== null).length || 0;
    const analyzed = data?.filter(item => item.ai_analyzed_at !== null).length || 0;
    const pending = total - analyzed;

    const confidenceScores = data
      ?.filter(item => item.ai_confidence_score !== null)
      .map(item => item.ai_confidence_score) || [];

    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

    return {
      total_action_items: total,
      analyzed,
      pending,
      avg_confidence: avgConfidence
    };
  }
}

export default AIActionItemAnalysisService;
