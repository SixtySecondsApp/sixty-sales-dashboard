/**
 * Workflow Environment Service
 * Manages Build, Staging, and Live environments for workflow execution
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export type WorkflowEnvironment = 'build' | 'staging' | 'live';

export interface EnvironmentConfig {
  id?: string;
  workflowId: string;
  environment: WorkflowEnvironment;
  config: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    enableDebugMode?: boolean;
    enableProfiling?: boolean;
    retryPolicy?: {
      maxAttempts: number;
      backoffMultiplier: number;
      initialDelayMs: number;
    };
  };
  variables: Record<string, any>;
  secrets: Record<string, string>;
  webhookUrls: {
    primary?: string;
    test?: string;
    mirror?: string;
  };
  rateLimits: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };
  isActive: boolean;
}

export interface EnvironmentPromotion {
  workflowId: string;
  fromEnvironment: WorkflowEnvironment;
  toEnvironment: WorkflowEnvironment;
  changesDiff?: Record<string, any>;
  rollbackData?: Record<string, any>;
}

export interface WebhookMirrorConfig {
  workflowId: string;
  sourceEnvironment: WorkflowEnvironment;
  targetEnvironment: WorkflowEnvironment;
  mirrorPercentage: number; // 0-100
  filterRules: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex';
    value: any;
  }>;
  isActive: boolean;
}

class WorkflowEnvironmentService {
  private static instance: WorkflowEnvironmentService;
  private environmentCache: Map<string, EnvironmentConfig> = new Map();
  private activeEnvironment: WorkflowEnvironment = 'build';

  private constructor() {}

  static getInstance(): WorkflowEnvironmentService {
    if (!WorkflowEnvironmentService.instance) {
      WorkflowEnvironmentService.instance = new WorkflowEnvironmentService();
    }
    return WorkflowEnvironmentService.instance;
  }

  /**
   * Get current active environment
   */
  getCurrentEnvironment(): WorkflowEnvironment {
    return this.activeEnvironment;
  }

  /**
   * Set active environment
   */
  setActiveEnvironment(environment: WorkflowEnvironment): void {
    this.activeEnvironment = environment;
    logger.info(`Switched to ${environment} environment`);
  }

  /**
   * Get or create environment configuration
   */
  async getEnvironmentConfig(
    workflowId: string,
    environment: WorkflowEnvironment
  ): Promise<EnvironmentConfig | null> {
    const cacheKey = `${workflowId}-${environment}`;
    
    // Check cache first
    if (this.environmentCache.has(cacheKey)) {
      return this.environmentCache.get(cacheKey)!;
    }

    try {
      // Fetch from database
      const { data, error } = await supabase
        .from('workflow_environments')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('environment', environment)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Create default environment config
        const defaultConfig = this.createDefaultEnvironmentConfig(workflowId, environment);
        await this.saveEnvironmentConfig(defaultConfig);
        return defaultConfig;
      }

      const config: EnvironmentConfig = {
        id: data.id,
        workflowId: data.workflow_id,
        environment: data.environment,
        config: data.config || {},
        variables: data.variables || {},
        secrets: data.secrets || {},
        webhookUrls: data.webhook_urls || {},
        rateLimits: data.rate_limits || {},
        isActive: data.is_active
      };

      // Cache the result
      this.environmentCache.set(cacheKey, config);
      return config;
    } catch (error) {
      logger.error('Failed to get environment config:', error);
      return null;
    }
  }

  /**
   * Save environment configuration
   */
  async saveEnvironmentConfig(config: EnvironmentConfig): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workflow_environments')
        .upsert({
          id: config.id,
          workflow_id: config.workflowId,
          environment: config.environment,
          config: config.config,
          variables: config.variables,
          secrets: config.secrets,
          webhook_urls: config.webhookUrls,
          rate_limits: config.rateLimits,
          is_active: config.isActive
        })
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const cacheKey = `${config.workflowId}-${config.environment}`;
      this.environmentCache.set(cacheKey, config);

      logger.info(`Saved ${config.environment} environment config for workflow ${config.workflowId}`);
      return true;
    } catch (error) {
      logger.error('Failed to save environment config:', error);
      return false;
    }
  }

  /**
   * Create default environment configuration
   */
  private createDefaultEnvironmentConfig(
    workflowId: string,
    environment: WorkflowEnvironment
  ): EnvironmentConfig {
    const baseConfig = {
      workflowId,
      environment,
      variables: {},
      secrets: {},
      webhookUrls: {},
      rateLimits: {},
      isActive: true
    };

    switch (environment) {
      case 'build':
        return {
          ...baseConfig,
          config: {
            maxExecutionTime: 30000, // 30 seconds
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB
            enableDebugMode: true,
            enableProfiling: true,
            retryPolicy: {
              maxAttempts: 1,
              backoffMultiplier: 1,
              initialDelayMs: 0
            }
          }
        };

      case 'staging':
        return {
          ...baseConfig,
          config: {
            maxExecutionTime: 60000, // 60 seconds
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            enableDebugMode: true,
            enableProfiling: false,
            retryPolicy: {
              maxAttempts: 2,
              backoffMultiplier: 2,
              initialDelayMs: 1000
            }
          }
        };

      case 'live':
        return {
          ...baseConfig,
          config: {
            maxExecutionTime: 120000, // 120 seconds
            maxMemoryUsage: 200 * 1024 * 1024, // 200MB
            enableDebugMode: false,
            enableProfiling: false,
            retryPolicy: {
              maxAttempts: 3,
              backoffMultiplier: 2,
              initialDelayMs: 1000
            }
          }
        };
    }
  }

  /**
   * Promote workflow from one environment to another
   */
  async promoteEnvironment(
    workflowId: string,
    fromEnv: WorkflowEnvironment,
    toEnv: WorkflowEnvironment
  ): Promise<boolean> {
    try {
      // Get source environment config
      const sourceConfig = await this.getEnvironmentConfig(workflowId, fromEnv);
      if (!sourceConfig) {
        throw new Error(`Source environment ${fromEnv} not found`);
      }

      // Get target environment config for rollback
      const targetConfig = await this.getEnvironmentConfig(workflowId, toEnv);
      
      // Calculate changes diff
      const changesDiff = this.calculateDiff(targetConfig, sourceConfig);

      // Save promotion history
      const { error: historyError } = await supabase
        .from('workflow_environment_promotions')
        .insert({
          workflow_id: workflowId,
          from_environment: fromEnv,
          to_environment: toEnv,
          changes_diff: changesDiff,
          rollback_data: targetConfig,
          status: 'pending'
        });

      if (historyError) throw historyError;

      // Copy configuration to target environment
      const promotedConfig: EnvironmentConfig = {
        ...sourceConfig,
        environment: toEnv
      };

      // Save promoted configuration
      const success = await this.saveEnvironmentConfig(promotedConfig);

      // Update promotion status
      await supabase
        .from('workflow_environment_promotions')
        .update({ status: success ? 'completed' : 'failed' })
        .eq('workflow_id', workflowId)
        .order('promoted_at', { ascending: false })
        .limit(1);

      if (success) {
        logger.info(`Promoted workflow ${workflowId} from ${fromEnv} to ${toEnv}`);
      }

      return success;
    } catch (error) {
      logger.error('Failed to promote environment:', error);
      return false;
    }
  }

  /**
   * Rollback environment promotion
   */
  async rollbackPromotion(workflowId: string, promotionId: string): Promise<boolean> {
    try {
      // Get promotion record
      const { data: promotion, error } = await supabase
        .from('workflow_environment_promotions')
        .select('*')
        .eq('id', promotionId)
        .single();

      if (error || !promotion) {
        throw new Error('Promotion record not found');
      }

      // Restore previous configuration
      if (promotion.rollback_data) {
        const success = await this.saveEnvironmentConfig(promotion.rollback_data);
        
        if (success) {
          // Update promotion status
          await supabase
            .from('workflow_environment_promotions')
            .update({ status: 'rolled_back' })
            .eq('id', promotionId);

          logger.info(`Rolled back promotion ${promotionId}`);
        }

        return success;
      }

      return false;
    } catch (error) {
      logger.error('Failed to rollback promotion:', error);
      return false;
    }
  }

  /**
   * Configure webhook mirroring between environments
   */
  async configureWebhookMirroring(config: WebhookMirrorConfig): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('webhook_mirror_config')
        .upsert({
          workflow_id: config.workflowId,
          source_environment: config.sourceEnvironment,
          target_environment: config.targetEnvironment,
          mirror_percentage: config.mirrorPercentage,
          filter_rules: config.filterRules,
          is_active: config.isActive
        });

      if (error) throw error;

      logger.info(
        `Configured webhook mirroring from ${config.sourceEnvironment} to ${config.targetEnvironment} ` +
        `at ${config.mirrorPercentage}% for workflow ${config.workflowId}`
      );

      return true;
    } catch (error) {
      logger.error('Failed to configure webhook mirroring:', error);
      return false;
    }
  }

  /**
   * Check if request should be mirrored based on configuration
   */
  async shouldMirrorRequest(
    workflowId: string,
    sourceEnv: WorkflowEnvironment,
    requestData: any
  ): Promise<{ shouldMirror: boolean; targetEnv?: WorkflowEnvironment }> {
    try {
      const { data: configs, error } = await supabase
        .from('webhook_mirror_config')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('source_environment', sourceEnv)
        .eq('is_active', true);

      if (error || !configs || configs.length === 0) {
        return { shouldMirror: false };
      }

      for (const config of configs) {
        // Check mirror percentage
        const random = Math.random() * 100;
        if (random > config.mirror_percentage) {
          continue;
        }

        // Check filter rules
        let passesFilters = true;
        for (const rule of config.filter_rules || []) {
          const value = this.getNestedValue(requestData, rule.field);
          
          switch (rule.operator) {
            case 'equals':
              if (value !== rule.value) passesFilters = false;
              break;
            case 'contains':
              if (!String(value).includes(rule.value)) passesFilters = false;
              break;
            case 'regex':
              if (!new RegExp(rule.value).test(String(value))) passesFilters = false;
              break;
          }

          if (!passesFilters) break;
        }

        if (passesFilters) {
          return {
            shouldMirror: true,
            targetEnv: config.target_environment as WorkflowEnvironment
          };
        }
      }

      return { shouldMirror: false };
    } catch (error) {
      logger.error('Failed to check mirror configuration:', error);
      return { shouldMirror: false };
    }
  }

  /**
   * Calculate diff between two configurations
   */
  private calculateDiff(oldConfig: any, newConfig: any): Record<string, any> {
    const diff: Record<string, any> = {};

    const allKeys = new Set([
      ...Object.keys(oldConfig || {}),
      ...Object.keys(newConfig || {})
    ]);

    for (const key of allKeys) {
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diff[key] = {
          old: oldValue,
          new: newValue
        };
      }
    }

    return diff;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Clear environment cache
   */
  clearCache(): void {
    this.environmentCache.clear();
  }
}

export const workflowEnvironmentService = WorkflowEnvironmentService.getInstance();