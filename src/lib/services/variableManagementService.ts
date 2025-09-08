/**
 * Variable Management Service
 * Enhanced variable system with scopes and persistent storage
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export type VariableScope = 'global' | 'workflow' | 'execution' | 'branch' | 'ephemeral';

export interface Variable {
  id?: string;
  workflowId?: string;
  executionId?: string;
  scope: VariableScope;
  key: string;
  value: any;
  ttlSeconds?: number;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VariableContext {
  global: Record<string, any>;
  workflow: Record<string, any>;
  execution: Record<string, any>;
  branch: Record<string, any>;
  ephemeral: Record<string, any>;
  nodeOutputs: Record<string, any>;
  systemVariables: Record<string, any>;
}

export interface ExpressionResult {
  value: any;
  type: string;
  error?: string;
}

export interface VariableAutocomplete {
  path: string;
  type: string;
  description?: string;
  value?: any;
}

class VariableManagementService {
  private static instance: VariableManagementService;
  private variableCache: Map<string, Variable> = new Map();
  private contextCache: Map<string, VariableContext> = new Map();
  private expirationTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    // Start cleanup interval for expired variables
    setInterval(() => this.cleanupExpiredVariables(), 60000); // Every minute
  }

  static getInstance(): VariableManagementService {
    if (!VariableManagementService.instance) {
      VariableManagementService.instance = new VariableManagementService();
    }
    return VariableManagementService.instance;
  }

  /**
   * Set a variable with scope
   */
  async setVariable(
    key: string,
    value: any,
    scope: VariableScope,
    options: {
      workflowId?: string;
      executionId?: string;
      ttlSeconds?: number;
    } = {}
  ): Promise<Variable | null> {
    try {
      const variable: Variable = {
        key,
        value,
        scope,
        workflowId: options.workflowId,
        executionId: options.executionId,
        ttlSeconds: options.ttlSeconds
      };

      // Calculate expiration if TTL is set
      if (options.ttlSeconds) {
        const expiresAt = new Date(Date.now() + options.ttlSeconds * 1000);
        variable.expiresAt = expiresAt.toISOString();
      }

      // Handle ephemeral variables (memory only)
      if (scope === 'ephemeral') {
        const cacheKey = this.getCacheKey(key, scope, options.workflowId, options.executionId);
        this.variableCache.set(cacheKey, variable);
        
        // Set expiration timer if needed
        if (options.ttlSeconds) {
          this.setExpirationTimer(cacheKey, options.ttlSeconds);
        }
        
        return variable;
      }

      // Store persistent variables in database
      const { data, error } = await supabase
        .from('variable_storage')
        .upsert({
          workflow_id: variable.workflowId,
          execution_id: variable.executionId,
          scope: variable.scope,
          key: variable.key,
          value: variable.value,
          ttl_seconds: variable.ttlSeconds,
          expires_at: variable.expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      variable.id = data.id;
      variable.createdAt = data.created_at;
      variable.updatedAt = data.updated_at;

      // Update cache
      const cacheKey = this.getCacheKey(key, scope, options.workflowId, options.executionId);
      this.variableCache.set(cacheKey, variable);

      logger.debug(`Set ${scope} variable '${key}'`);
      return variable;
    } catch (error) {
      logger.error('Failed to set variable:', error);
      return null;
    }
  }

  /**
   * Get a variable by key and scope
   */
  async getVariable(
    key: string,
    scope: VariableScope,
    options: {
      workflowId?: string;
      executionId?: string;
    } = {}
  ): Promise<any> {
    try {
      const cacheKey = this.getCacheKey(key, scope, options.workflowId, options.executionId);
      
      // Check cache first
      if (this.variableCache.has(cacheKey)) {
        const cached = this.variableCache.get(cacheKey)!;
        
        // Check if expired
        if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
          this.variableCache.delete(cacheKey);
          return undefined;
        }
        
        return cached.value;
      }

      // Ephemeral variables are memory-only
      if (scope === 'ephemeral') {
        return undefined;
      }

      // Fetch from database
      let query = supabase
        .from('variable_storage')
        .select('*')
        .eq('scope', scope)
        .eq('key', key);

      if (options.workflowId) {
        query = query.eq('workflow_id', options.workflowId);
      }
      if (options.executionId) {
        query = query.eq('execution_id', options.executionId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return undefined;
      }

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Delete expired variable
        await this.deleteVariable(key, scope, options);
        return undefined;
      }

      // Update cache
      const variable: Variable = {
        id: data.id,
        key: data.key,
        value: data.value,
        scope: data.scope,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
        ttlSeconds: data.ttl_seconds,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      this.variableCache.set(cacheKey, variable);
      return variable.value;
    } catch (error) {
      logger.error('Failed to get variable:', error);
      return undefined;
    }
  }

  /**
   * Delete a variable
   */
  async deleteVariable(
    key: string,
    scope: VariableScope,
    options: {
      workflowId?: string;
      executionId?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key, scope, options.workflowId, options.executionId);
      
      // Remove from cache
      this.variableCache.delete(cacheKey);
      
      // Clear expiration timer if exists
      const timer = this.expirationTimers.get(cacheKey);
      if (timer) {
        clearTimeout(timer);
        this.expirationTimers.delete(cacheKey);
      }

      // Ephemeral variables are memory-only
      if (scope === 'ephemeral') {
        return true;
      }

      // Delete from database
      let query = supabase
        .from('variable_storage')
        .delete()
        .eq('scope', scope)
        .eq('key', key);

      if (options.workflowId) {
        query = query.eq('workflow_id', options.workflowId);
      }
      if (options.executionId) {
        query = query.eq('execution_id', options.executionId);
      }

      const { error } = await query;

      if (error) throw error;

      logger.debug(`Deleted ${scope} variable '${key}'`);
      return true;
    } catch (error) {
      logger.error('Failed to delete variable:', error);
      return false;
    }
  }

  /**
   * Get complete variable context for execution
   */
  async getVariableContext(
    workflowId: string,
    executionId?: string
  ): Promise<VariableContext> {
    const cacheKey = `${workflowId}-${executionId || 'default'}`;
    
    // Check cache
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    const context: VariableContext = {
      global: {},
      workflow: {},
      execution: {},
      branch: {},
      ephemeral: {},
      nodeOutputs: {},
      systemVariables: this.getSystemVariables()
    };

    try {
      // Fetch all variables for the workflow
      const { data: variables, error } = await supabase
        .from('variable_storage')
        .select('*')
        .or(`workflow_id.eq.${workflowId},scope.eq.global`);

      if (error) throw error;

      // Organize variables by scope
      for (const variable of variables || []) {
        // Skip expired variables
        if (variable.expires_at && new Date(variable.expires_at) < new Date()) {
          continue;
        }

        switch (variable.scope) {
          case 'global':
            context.global[variable.key] = variable.value;
            break;
          case 'workflow':
            if (variable.workflow_id === workflowId) {
              context.workflow[variable.key] = variable.value;
            }
            break;
          case 'execution':
            if (executionId && variable.execution_id === executionId) {
              context.execution[variable.key] = variable.value;
            }
            break;
          case 'branch':
            if (executionId && variable.execution_id === executionId) {
              context.branch[variable.key] = variable.value;
            }
            break;
        }
      }

      // Add ephemeral variables from cache
      for (const [key, variable] of this.variableCache.entries()) {
        if (variable.scope === 'ephemeral' && 
            (!variable.workflowId || variable.workflowId === workflowId)) {
          // Check if expired
          if (!variable.expiresAt || new Date(variable.expiresAt) > new Date()) {
            context.ephemeral[variable.key] = variable.value;
          }
        }
      }

      // Cache the context
      this.contextCache.set(cacheKey, context);
      
      // Set cache expiration
      setTimeout(() => {
        this.contextCache.delete(cacheKey);
      }, 60000); // Cache for 1 minute

      return context;
    } catch (error) {
      logger.error('Failed to get variable context:', error);
      return context;
    }
  }

  /**
   * Evaluate expression with variable interpolation
   */
  evaluateExpression(
    expression: string,
    context: VariableContext
  ): ExpressionResult {
    try {
      // Replace variable references in the expression
      // Format: {{ scope.key }} or {{ node("nodeId").output.field }}
      const interpolated = expression.replace(
        /{{\s*([^}]+)\s*}}/g,
        (match, path) => {
          const value = this.resolveVariablePath(path.trim(), context);
          return JSON.stringify(value);
        }
      );

      // Evaluate the expression safely
      const result = this.safeEval(interpolated, context);

      return {
        value: result,
        type: typeof result
      };
    } catch (error) {
      return {
        value: undefined,
        type: 'undefined',
        error: (error as Error).message
      };
    }
  }

  /**
   * Resolve variable path
   */
  private resolveVariablePath(path: string, context: VariableContext): any {
    // Handle node output references: node("nodeId").field.subfield
    const nodeMatch = path.match(/^node\("([^"]+)"\)(?:\.(.+))?$/);
    if (nodeMatch) {
      const [, nodeId, fieldPath] = nodeMatch;
      const nodeOutput = context.nodeOutputs[nodeId];
      
      if (!nodeOutput) return undefined;
      
      if (!fieldPath) return nodeOutput;
      
      return this.getNestedValue(nodeOutput, fieldPath);
    }

    // Handle direct scope references: scope.key.field
    const parts = path.split('.');
    const scope = parts[0];
    
    if (scope in context) {
      const scopeData = context[scope as keyof VariableContext];
      if (parts.length === 1) return scopeData;
      
      const key = parts[1];
      const value = scopeData[key];
      
      if (parts.length === 2) return value;
      
      // Handle nested fields
      return this.getNestedValue(value, parts.slice(2).join('.'));
    }

    // Check system variables
    if (scope === 'system') {
      return this.getNestedValue(context.systemVariables, parts.slice(1).join('.'));
    }

    return undefined;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      // Handle array indexing
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current[arrayKey]?.[parseInt(index)];
      }
      
      return current[key];
    }, obj);
  }

  /**
   * Safe evaluation of expressions
   */
  private safeEval(expression: string, context: VariableContext): any {
    // Create a sandboxed evaluation context
    const sandbox = {
      ...context.global,
      ...context.workflow,
      ...context.execution,
      ...context.branch,
      ...context.ephemeral,
      system: context.systemVariables,
      node: (id: string) => context.nodeOutputs[id],
      // Add safe functions
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      String,
      Number,
      Boolean,
      Array,
      Object
    };

    // Use Function constructor for safer evaluation
    try {
      const func = new Function(...Object.keys(sandbox), `return ${expression}`);
      return func(...Object.values(sandbox));
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get system variables
   */
  private getSystemVariables(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      date: new Date().toDateString(),
      time: new Date().toTimeString(),
      random: Math.random(),
      env: process.env.NODE_ENV || 'development',
      platform: navigator?.platform || 'unknown',
      userAgent: navigator?.userAgent || 'unknown'
    };
  }

  /**
   * Get autocomplete suggestions for expressions
   */
  getAutocomplete(
    partialPath: string,
    context: VariableContext
  ): VariableAutocomplete[] {
    const suggestions: VariableAutocomplete[] = [];

    // Add scope suggestions
    if (!partialPath || partialPath === '') {
      const scopes = ['global', 'workflow', 'execution', 'branch', 'ephemeral', 'system', 'node'];
      scopes.forEach(scope => {
        suggestions.push({
          path: scope,
          type: 'scope',
          description: `${scope} variables`
        });
      });
      return suggestions;
    }

    // Handle node function autocomplete
    if (partialPath.startsWith('node(')) {
      // Suggest node IDs
      Object.keys(context.nodeOutputs).forEach(nodeId => {
        suggestions.push({
          path: `node("${nodeId}")`,
          type: 'node',
          description: `Output from node ${nodeId}`
        });
      });
      return suggestions;
    }

    // Parse the path
    const parts = partialPath.split('.');
    const scope = parts[0];

    if (scope in context) {
      const scopeData = context[scope as keyof VariableContext];
      
      if (parts.length === 1) {
        // Suggest keys in scope
        Object.keys(scopeData).forEach(key => {
          suggestions.push({
            path: `${scope}.${key}`,
            type: typeof scopeData[key],
            value: scopeData[key]
          });
        });
      } else if (parts.length === 2) {
        // Suggest nested fields
        const key = parts[1];
        const value = scopeData[key];
        
        if (value && typeof value === 'object') {
          Object.keys(value).forEach(field => {
            suggestions.push({
              path: `${scope}.${key}.${field}`,
              type: typeof value[field],
              value: value[field]
            });
          });
        }
      }
    }

    // Filter by partial match
    const searchTerm = parts[parts.length - 1].toLowerCase();
    return suggestions.filter(s => 
      s.path.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Clear variables for an execution
   */
  async clearExecutionVariables(executionId: string): Promise<boolean> {
    try {
      // Clear from cache
      const keysToDelete: string[] = [];
      for (const [key, variable] of this.variableCache.entries()) {
        if (variable.executionId === executionId && 
            (variable.scope === 'execution' || variable.scope === 'branch' || variable.scope === 'ephemeral')) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.variableCache.delete(key);
        const timer = this.expirationTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.expirationTimers.delete(key);
        }
      });

      // Clear from database
      const { error } = await supabase
        .from('variable_storage')
        .delete()
        .eq('execution_id', executionId)
        .in('scope', ['execution', 'branch']);

      if (error) throw error;

      logger.debug(`Cleared variables for execution ${executionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to clear execution variables:', error);
      return false;
    }
  }

  /**
   * Clean up expired variables
   */
  private async cleanupExpiredVariables(): Promise<void> {
    try {
      // Clean up database variables
      const { error } = await supabase
        .from('variable_storage')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Clean up cached variables
      const now = new Date();
      const keysToDelete: string[] = [];
      
      for (const [key, variable] of this.variableCache.entries()) {
        if (variable.expiresAt && new Date(variable.expiresAt) < now) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.variableCache.delete(key);
        const timer = this.expirationTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.expirationTimers.delete(key);
        }
      });

      if (keysToDelete.length > 0) {
        logger.debug(`Cleaned up ${keysToDelete.length} expired variables`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired variables:', error);
    }
  }

  /**
   * Set expiration timer for a variable
   */
  private setExpirationTimer(cacheKey: string, ttlSeconds: number): void {
    // Clear existing timer if any
    const existingTimer = this.expirationTimers.get(cacheKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.variableCache.delete(cacheKey);
      this.expirationTimers.delete(cacheKey);
    }, ttlSeconds * 1000);

    this.expirationTimers.set(cacheKey, timer);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    key: string,
    scope: VariableScope,
    workflowId?: string,
    executionId?: string
  ): string {
    return `${scope}-${workflowId || 'global'}-${executionId || 'default'}-${key}`;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.variableCache.clear();
    this.contextCache.clear();
    
    // Clear all timers
    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }
    this.expirationTimers.clear();
  }
}

export const variableManagementService = VariableManagementService.getInstance();