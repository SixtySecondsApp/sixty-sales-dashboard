/**
 * AIPromptTracker - Tracks AI prompts used during test_data mode
 *
 * Monitors AI prompt executions during test runs, providing:
 * - Links to view/edit prompts in the AI prompts settings page
 * - Token usage and cost tracking
 * - Performance metrics for AI calls
 */

import { TrackedAIPrompt } from '@/lib/types/processMapTesting';

/**
 * Options for adding a new AI prompt execution
 */
export interface AddPromptExecutionOptions {
  stepId: string;
  stepName: string;
  featureKey: string;
  templateId?: string | null;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  costCents?: number;
  modelUsed?: string;
  durationMs?: number;
}

/**
 * AI prompt execution summary
 */
export interface AIPromptSummary {
  totalPrompts: number;
  totalTokens: number;
  totalCostCents: number;
  avgDurationMs: number;
  byFeature: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * AIPromptTracker class
 *
 * Tracks all AI prompt executions during test_data mode:
 * - Records which prompts were used and when
 * - Tracks token usage and estimated costs
 * - Provides links to the AI prompts settings page
 * - Calculates usage summaries for reporting
 */
export class AIPromptTracker {
  private prompts: Map<string, TrackedAIPrompt> = new Map();
  private executionOrder: string[] = [];

  /**
   * Build URL to view a prompt in the AI prompts settings page
   */
  static buildPromptViewUrl(featureKey: string): string {
    // The AI prompts page uses feature keys to identify prompts
    // URL format: /settings/ai-prompts?feature={featureKey}
    return `/settings/ai-prompts?feature=${encodeURIComponent(featureKey)}`;
  }

  /**
   * Add a new AI prompt execution
   */
  addPromptExecution(options: AddPromptExecutionOptions): TrackedAIPrompt {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const prompt: TrackedAIPrompt = {
      id,
      stepId: options.stepId,
      stepName: options.stepName,
      featureKey: options.featureKey,
      templateId: options.templateId || null,
      promptViewUrl: AIPromptTracker.buildPromptViewUrl(options.featureKey),
      tokenUsage: options.tokenUsage,
      costCents: options.costCents,
      modelUsed: options.modelUsed,
      executedAt: new Date().toISOString(),
      durationMs: options.durationMs,
    };

    this.prompts.set(id, prompt);
    this.executionOrder.push(id);

    return prompt;
  }

  /**
   * Get a prompt execution by ID
   */
  getPrompt(id: string): TrackedAIPrompt | undefined {
    return this.prompts.get(id);
  }

  /**
   * Get all prompt executions
   */
  getAllPrompts(): TrackedAIPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get prompt executions in order
   */
  getPromptsInOrder(): TrackedAIPrompt[] {
    return this.executionOrder
      .map(id => this.prompts.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get prompts by step
   */
  getPromptsByStep(stepId: string): TrackedAIPrompt[] {
    return this.getAllPrompts().filter(p => p.stepId === stepId);
  }

  /**
   * Get prompts by feature key
   */
  getPromptsByFeature(featureKey: string): TrackedAIPrompt[] {
    return this.getAllPrompts().filter(p => p.featureKey === featureKey);
  }

  /**
   * Get unique feature keys used
   */
  getUniqueFeatureKeys(): string[] {
    const featureKeys = new Set<string>();
    this.getAllPrompts().forEach(p => featureKeys.add(p.featureKey));
    return Array.from(featureKeys);
  }

  /**
   * Get total token usage
   */
  getTotalTokenUsage(): { input: number; output: number; total: number } {
    const prompts = this.getAllPrompts();
    return prompts.reduce(
      (acc, p) => ({
        input: acc.input + (p.tokenUsage?.input || 0),
        output: acc.output + (p.tokenUsage?.output || 0),
        total: acc.total + (p.tokenUsage?.total || 0),
      }),
      { input: 0, output: 0, total: 0 }
    );
  }

  /**
   * Get total cost in cents
   */
  getTotalCostCents(): number {
    return this.getAllPrompts().reduce((acc, p) => acc + (p.costCents || 0), 0);
  }

  /**
   * Get average duration in ms
   */
  getAverageDurationMs(): number {
    const prompts = this.getAllPrompts().filter(p => p.durationMs !== undefined);
    if (prompts.length === 0) return 0;

    const totalDuration = prompts.reduce((acc, p) => acc + (p.durationMs || 0), 0);
    return Math.round(totalDuration / prompts.length);
  }

  /**
   * Get summary statistics
   */
  getSummary(): AIPromptSummary {
    const prompts = this.getAllPrompts();

    const byFeature: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    prompts.forEach(prompt => {
      byFeature[prompt.featureKey] = (byFeature[prompt.featureKey] || 0) + 1;
      if (prompt.modelUsed) {
        byModel[prompt.modelUsed] = (byModel[prompt.modelUsed] || 0) + 1;
      }
    });

    const tokenUsage = this.getTotalTokenUsage();

    return {
      totalPrompts: prompts.length,
      totalTokens: tokenUsage.total,
      totalCostCents: this.getTotalCostCents(),
      avgDurationMs: this.getAverageDurationMs(),
      byFeature,
      byModel,
    };
  }

  /**
   * Format cost for display
   */
  formatCost(): string {
    const cents = this.getTotalCostCents();
    if (cents === 0) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get detailed report for each prompt
   */
  getDetailedReport(): Array<{
    stepName: string;
    featureKey: string;
    model: string;
    tokens: number;
    cost: string;
    duration: string;
    viewUrl: string;
  }> {
    return this.getPromptsInOrder().map(prompt => ({
      stepName: prompt.stepName,
      featureKey: prompt.featureKey,
      model: prompt.modelUsed || 'unknown',
      tokens: prompt.tokenUsage?.total || 0,
      cost: prompt.costCents ? `$${(prompt.costCents / 100).toFixed(4)}` : '-',
      duration: prompt.durationMs ? `${prompt.durationMs}ms` : '-',
      viewUrl: prompt.promptViewUrl,
    }));
  }

  /**
   * Clear all tracked prompts
   */
  clear(): void {
    this.prompts.clear();
    this.executionOrder = [];
  }

  /**
   * Export prompts for persistence/debugging
   */
  export(): TrackedAIPrompt[] {
    return this.getAllPrompts();
  }

  /**
   * Import prompts (e.g., from a saved test run)
   */
  import(prompts: TrackedAIPrompt[]): void {
    this.clear();
    prompts.forEach(prompt => {
      this.prompts.set(prompt.id, prompt);
      this.executionOrder.push(prompt.id);
    });
  }
}
