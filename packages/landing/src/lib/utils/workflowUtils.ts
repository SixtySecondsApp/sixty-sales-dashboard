/**
 * Workflow Utilities
 * 
 * Comprehensive utility functions for workflow operations including:
 * - Workflow validation and testing
 * - Canvas data processing
 * - Template management
 * - Performance optimization
 * - Export/Import functionality
 */

import { supabase } from '@/lib/supabase/clientV2';
import { workflowExecutionEngine, type WorkflowRule } from './workflowExecutionEngine';
import logger from '@/lib/utils/logger';

// Canvas and Visual Types
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  position: { x: number; y: number };
  data: {
    label: string;
    type?: string;
    iconName?: string;
    config?: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, any>;
}

export interface WorkflowCanvas {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowTemplate {
  id?: string;
  name: string;
  description?: string;
  category: string;
  canvasData: WorkflowCanvas;
  triggerType: string;
  triggerConditions: Record<string, any>;
  actionType: string;
  actionConfig: Record<string, any>;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  estimatedSetupTime: number;
  tags: string[];
  isPublic: boolean;
  usageCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedExecutionTime: number;
}

export interface WorkflowTestResult {
  success: boolean;
  executionTime: number;
  result?: Record<string, any>;
  error?: string;
  logs: string[];
  performance: {
    memoryUsage: number;
    cpuTime: number;
  };
}

export class WorkflowUtils {
  /**
   * Validate a workflow configuration
   */
  static validateWorkflow(
    canvasData: WorkflowCanvas,
    triggerType: string,
    triggerConditions: Record<string, any>,
    actionType: string,
    actionConfig: Record<string, any>
  ): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate canvas structure
    const canvasValidation = this.validateCanvasStructure(canvasData);
    errors.push(...canvasValidation.errors);
    warnings.push(...canvasValidation.warnings);

    // Validate trigger configuration
    const triggerValidation = this.validateTriggerConfig(triggerType, triggerConditions);
    errors.push(...triggerValidation.errors);
    warnings.push(...triggerValidation.warnings);

    // Validate action configuration
    const actionValidation = this.validateActionConfig(actionType, actionConfig);
    errors.push(...actionValidation.errors);
    warnings.push(...actionValidation.warnings);

    // Calculate complexity
    const complexity = this.calculateComplexity(canvasData, triggerConditions, actionConfig);
    
    // Estimate execution time
    const estimatedExecutionTime = this.estimateExecutionTime(
      triggerType,
      actionType,
      canvasData.nodes.length
    );

    // Generate suggestions
    if (canvasData.nodes.length > 10) {
      suggestions.push('Consider breaking this workflow into smaller, more manageable workflows');
    }
    
    if (complexity === 'high' && !triggerConditions || Object.keys(triggerConditions).length === 0) {
      suggestions.push('Add trigger conditions to prevent unnecessary executions');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      complexity,
      estimatedExecutionTime
    };
  }

  /**
   * Validate canvas structure
   */
  private static validateCanvasStructure(canvasData: WorkflowCanvas): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!canvasData || !canvasData.nodes || !canvasData.edges) {
      errors.push('Invalid canvas data structure');
      return { errors, warnings };
    }

    // Check for required nodes
    const triggerNodes = canvasData.nodes.filter(node => node.type === 'trigger');
    const actionNodes = canvasData.nodes.filter(node => node.type === 'action');

    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    if (actionNodes.length === 0) {
      errors.push('Workflow must have at least one action node');
    }

    if (triggerNodes.length > 1) {
      warnings.push('Multiple trigger nodes detected - only the first will be used');
    }

    // Validate node connections
    const nodeIds = new Set(canvasData.nodes.map(node => node.id));
    const disconnectedNodes: string[] = [];

    for (const node of canvasData.nodes) {
      const hasIncomingEdge = canvasData.edges.some(edge => edge.target === node.id);
      const hasOutgoingEdge = canvasData.edges.some(edge => edge.source === node.id);

      if (node.type === 'trigger' && !hasOutgoingEdge) {
        errors.push(`Trigger node ${node.id} has no outgoing connections`);
      } else if (node.type === 'action' && !hasIncomingEdge) {
        errors.push(`Action node ${node.id} has no incoming connections`);
      } else if (node.type === 'condition' && (!hasIncomingEdge || !hasOutgoingEdge)) {
        warnings.push(`Condition node ${node.id} should have both incoming and outgoing connections`);
      }
    }

    // Validate edge references
    for (const edge of canvasData.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
      }
    }

    // Check for cycles (advanced validation)
    if (this.hasCircularDependency(canvasData)) {
      warnings.push('Circular dependency detected in workflow - may cause infinite loops');
    }

    return { errors, warnings };
  }

  /**
   * Validate trigger configuration
   */
  private static validateTriggerConfig(
    triggerType: string,
    triggerConditions: Record<string, any>
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validTriggerTypes = [
      'activity_created',
      'stage_changed',
      'deal_created',
      'task_completed',
      'manual',
      'schedule'
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      errors.push(`Invalid trigger type: ${triggerType}`);
    }

    // Type-specific validations
    switch (triggerType) {
      case 'stage_changed':
        if (triggerConditions.stage && typeof triggerConditions.stage !== 'string') {
          errors.push('Stage trigger condition must be a string');
        }
        break;
      
      case 'activity_created':
        if (triggerConditions.activity_type && typeof triggerConditions.activity_type !== 'string') {
          errors.push('Activity type trigger condition must be a string');
        }
        break;

      case 'deal_created':
        if (triggerConditions.value_threshold && typeof triggerConditions.value_threshold !== 'number') {
          warnings.push('Value threshold should be a number for better filtering');
        }
        break;

      case 'schedule':
        if (!triggerConditions.cron_expression && !triggerConditions.interval_minutes) {
          errors.push('Scheduled triggers require either cron expression or interval');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate action configuration
   */
  private static validateActionConfig(
    actionType: string,
    actionConfig: Record<string, any>
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validActionTypes = [
      'create_deal',
      'update_deal_stage',
      'create_task',
      'create_activity',
      'send_notification',
      'update_field'
    ];

    if (!validActionTypes.includes(actionType)) {
      errors.push(`Invalid action type: ${actionType}`);
    }

    // Type-specific validations
    switch (actionType) {
      case 'create_deal':
        if (!actionConfig.deal_name && !actionConfig.dealName) {
          warnings.push('Deal name not specified - will use default template');
        }
        if (!actionConfig.target_stage_id && !actionConfig.targetStageId) {
          warnings.push('Target stage not specified - deal will be created in default stage');
        }
        break;

      case 'update_deal_stage':
        if (!actionConfig.target_stage_id && !actionConfig.targetStageId) {
          errors.push('Target stage ID is required for stage update actions');
        }
        break;

      case 'create_task':
        if (!actionConfig.task_title && !actionConfig.taskTitle) {
          warnings.push('Task title not specified - will use default template');
        }
        if (actionConfig.due_in_days && actionConfig.due_in_days < 0) {
          errors.push('Task due date cannot be in the past');
        }
        break;

      case 'send_notification':
        if (!actionConfig.message) {
          errors.push('Notification message is required');
        }
        if (actionConfig.channels && !Array.isArray(actionConfig.channels)) {
          errors.push('Notification channels must be an array');
        }
        break;

      case 'update_field':
        if (!actionConfig.field_name && !actionConfig.field) {
          errors.push('Field name is required for field update actions');
        }
        if (!actionConfig.field_value && !actionConfig.value) {
          warnings.push('Field value not specified - field will be set to empty');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Calculate workflow complexity
   */
  private static calculateComplexity(
    canvasData: WorkflowCanvas,
    triggerConditions: Record<string, any>,
    actionConfig: Record<string, any>
  ): 'low' | 'medium' | 'high' {
    let complexity = 0;

    // Node complexity
    complexity += canvasData.nodes.length * 2;

    // Edge complexity
    complexity += canvasData.edges.length;

    // Condition complexity
    const conditionNodes = canvasData.nodes.filter(node => node.type === 'condition');
    complexity += conditionNodes.length * 3;

    // Trigger condition complexity
    complexity += Object.keys(triggerConditions).length * 2;

    // Action configuration complexity
    complexity += Object.keys(actionConfig).length;

    // Variable substitution complexity
    const hasVariables = JSON.stringify(actionConfig).includes('{') && JSON.stringify(actionConfig).includes('}');
    if (hasVariables) complexity += 5;

    if (complexity <= 10) return 'low';
    if (complexity <= 25) return 'medium';
    return 'high';
  }

  /**
   * Estimate execution time in milliseconds
   */
  private static estimateExecutionTime(
    triggerType: string,
    actionType: string,
    nodeCount: number
  ): number {
    let baseTime = 100; // Base processing time

    // Trigger type overhead
    const triggerOverhead = {
      'activity_created': 50,
      'stage_changed': 100,
      'deal_created': 150,
      'task_completed': 50,
      'manual': 10,
      'schedule': 20
    };
    baseTime += triggerOverhead[triggerType] || 50;

    // Action type overhead
    const actionOverhead = {
      'create_deal': 300,
      'update_deal_stage': 200,
      'create_task': 250,
      'create_activity': 200,
      'send_notification': 100,
      'update_field': 150
    };
    baseTime += actionOverhead[actionType] || 100;

    // Node processing overhead
    baseTime += nodeCount * 25;

    return baseTime;
  }

  /**
   * Check for circular dependencies in workflow
   */
  private static hasCircularDependency(canvasData: WorkflowCanvas): boolean {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    for (const node of canvasData.nodes) {
      graph.set(node.id, []);
    }
    
    for (const edge of canvasData.edges) {
      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edge.target);
      graph.set(edge.source, neighbors);
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Test workflow execution in safe mode
   */
  static async testWorkflow(
    ruleId: string,
    testData: Record<string, any>
  ): Promise<WorkflowTestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    
    // Mock performance monitoring
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      logs.push(`Starting workflow test at ${new Date().toISOString()}`);
      logs.push(`Test data: ${JSON.stringify(testData)}`);

      // Get workflow rule
      const { data: ruleData, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (error || !ruleData) {
        throw new Error('Workflow rule not found');
      }

      logs.push(`Loaded workflow rule: ${ruleData.rule_name}`);

      // Convert to WorkflowRule format
      const rule: WorkflowRule = {
        id: ruleData.id,
        userId: ruleData.user_id,
        ruleName: ruleData.rule_name,
        ruleDescription: ruleData.rule_description,
        canvasData: ruleData.canvas_data || {},
        templateId: ruleData.template_id,
        triggerType: ruleData.trigger_type,
        triggerConditions: ruleData.trigger_conditions || {},
        actionType: ruleData.action_type,
        actionConfig: ruleData.action_config || {},
        isActive: ruleData.is_active,
        priorityLevel: ruleData.priority_level || 1,
        tags: ruleData.tags || [],
        lastExecutedAt: ruleData.last_executed_at,
        executionCount: ruleData.execution_count || 0,
        successCount: ruleData.success_count || 0,
        failureCount: ruleData.failure_count || 0,
        averageExecutionTimeMs: ruleData.average_execution_time_ms || 0,
        createdAt: ruleData.created_at,
        updatedAt: ruleData.updated_at
      };

      // Execute workflow in test mode
      logs.push('Executing workflow in test mode...');
      
      const execution = await workflowExecutionEngine.executeWorkflowRule(
        rule,
        testData,
        'user'
      );

      logs.push(`Workflow execution completed with status: ${execution.status}`);

      const executionTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsage = finalMemory - initialMemory;

      return {
        success: execution.status === 'success',
        executionTime,
        result: execution.executionResult,
        error: execution.errorMessage,
        logs,
        performance: {
          memoryUsage: memoryUsage / 1024 / 1024, // Convert to MB
          cpuTime: executionTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsage = finalMemory - initialMemory;

      logs.push(`Workflow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs,
        performance: {
          memoryUsage: memoryUsage / 1024 / 1024,
          cpuTime: executionTime
        }
      };
    }
  }

  /**
   * Convert canvas data to workflow configuration
   */
  static canvasToWorkflowConfig(canvasData: WorkflowCanvas): {
    triggerType: string;
    triggerConditions: Record<string, any>;
    actionType: string;
    actionConfig: Record<string, any>;
  } {
    // Find trigger node
    const triggerNode = canvasData.nodes.find(node => node.type === 'trigger');
    if (!triggerNode) {
      throw new Error('No trigger node found in canvas');
    }

    // Find action nodes
    const actionNodes = canvasData.nodes.filter(node => node.type === 'action');
    if (actionNodes.length === 0) {
      throw new Error('No action nodes found in canvas');
    }

    // Extract trigger configuration
    const triggerType = triggerNode.data.type || 'manual';
    const triggerConditions = triggerNode.data.config || {};

    // Use the first action node for simplicity
    const actionNode = actionNodes[0];
    const actionType = actionNode.data.type || 'send_notification';
    const actionConfig = actionNode.data.config || {};

    // Process condition nodes to enhance trigger conditions
    const conditionNodes = canvasData.nodes.filter(node => node.type === 'condition');
    for (const conditionNode of conditionNodes) {
      if (conditionNode.data.config) {
        Object.assign(triggerConditions, conditionNode.data.config);
      }
    }

    return {
      triggerType,
      triggerConditions,
      actionType,
      actionConfig
    };
  }

  /**
   * Convert workflow configuration to canvas data
   */
  static workflowConfigToCanvas(
    triggerType: string,
    triggerConditions: Record<string, any>,
    actionType: string,
    actionConfig: Record<string, any>
  ): WorkflowCanvas {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Create trigger node
    nodes.push({
      id: 'trigger_1',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: this.getTriggerLabel(triggerType),
        type: triggerType,
        iconName: this.getTriggerIcon(triggerType),
        config: triggerConditions
      }
    });

    // Create condition node if conditions exist
    if (Object.keys(triggerConditions).length > 0) {
      nodes.push({
        id: 'condition_1',
        type: 'condition',
        position: { x: 300, y: 100 },
        data: {
          label: this.getConditionLabel(triggerConditions),
          config: triggerConditions
        }
      });

      edges.push({
        id: 'e1',
        source: 'trigger_1',
        target: 'condition_1'
      });
    }

    // Create action node
    const sourceNode = Object.keys(triggerConditions).length > 0 ? 'condition_1' : 'trigger_1';
    const actionX = Object.keys(triggerConditions).length > 0 ? 500 : 300;

    nodes.push({
      id: 'action_1',
      type: 'action',
      position: { x: actionX, y: 100 },
      data: {
        label: this.getActionLabel(actionType, actionConfig),
        type: actionType,
        iconName: this.getActionIcon(actionType),
        config: actionConfig
      }
    });

    edges.push({
      id: Object.keys(triggerConditions).length > 0 ? 'e2' : 'e1',
      source: sourceNode,
      target: 'action_1'
    });

    return {
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 }
    };
  }

  /**
   * Get workflow templates
   */
  static async getWorkflowTemplates(
    category?: string,
    difficulty?: 'easy' | 'medium' | 'hard'
  ): Promise<WorkflowTemplate[]> {
    try {
      let query = supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true);

      if (category) {
        query = query.eq('category', category);
      }

      if (difficulty) {
        query = query.eq('difficulty_level', difficulty);
      }

      const { data, error } = await query
        .order('usage_count', { ascending: false })
        .order('rating_avg', { ascending: false });

      if (error) {
        logger.error('Failed to fetch workflow templates:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get workflow templates:', error);
      return [];
    }
  }

  /**
   * Create workflow template
   */
  static async createWorkflowTemplate(
    template: Omit<WorkflowTemplate, 'id' | 'usageCount' | 'ratingAvg' | 'ratingCount' | 'createdAt' | 'updatedAt'>
  ): Promise<WorkflowTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('workflow_templates')
        .insert({
          name: template.name,
          description: template.description,
          category: template.category,
          canvas_data: template.canvasData,
          trigger_type: template.triggerType,
          trigger_conditions: template.triggerConditions,
          action_type: template.actionType,
          action_config: template.actionConfig,
          difficulty_level: template.difficultyLevel,
          estimated_setup_time: template.estimatedSetupTime,
          tags: template.tags,
          is_public: template.isPublic,
          created_by: template.createdBy
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create workflow template:', error);
        return null;
      }

      return data;

    } catch (error) {
      logger.error('Failed to create workflow template:', error);
      return null;
    }
  }

  /**
   * Export workflow configuration
   */
  static exportWorkflow(workflow: WorkflowRule): string {
    const exportData = {
      version: '1.0.0',
      name: workflow.ruleName,
      description: workflow.ruleDescription,
      canvas: workflow.canvasData,
      trigger: {
        type: workflow.triggerType,
        conditions: workflow.triggerConditions
      },
      action: {
        type: workflow.actionType,
        config: workflow.actionConfig
      },
      metadata: {
        priority: workflow.priorityLevel,
        tags: workflow.tags,
        exportedAt: new Date().toISOString()
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import workflow configuration
   */
  static importWorkflow(jsonData: string): Partial<WorkflowRule> | null {
    try {
      const data = JSON.parse(jsonData);

      // Validate import format
      if (!data.version || !data.trigger || !data.action) {
        throw new Error('Invalid workflow export format');
      }

      return {
        ruleName: data.name || 'Imported Workflow',
        ruleDescription: data.description,
        canvasData: data.canvas || {},
        triggerType: data.trigger.type,
        triggerConditions: data.trigger.conditions || {},
        actionType: data.action.type,
        actionConfig: data.action.config || {},
        priorityLevel: data.metadata?.priority || 1,
        tags: data.metadata?.tags || [],
        isActive: false // Imported workflows start inactive
      };

    } catch (error) {
      logger.error('Failed to import workflow:', error);
      return null;
    }
  }

  // Helper methods for labels and icons
  private static getTriggerLabel(triggerType: string): string {
    const labels = {
      'activity_created': 'Activity Created',
      'stage_changed': 'Stage Changed',
      'deal_created': 'Deal Created',
      'task_completed': 'Task Completed',
      'manual': 'Manual Trigger',
      'schedule': 'Scheduled'
    };
    return labels[triggerType] || triggerType;
  }

  private static getTriggerIcon(triggerType: string): string {
    const icons = {
      'activity_created': 'Activity',
      'stage_changed': 'Target',
      'deal_created': 'Database',
      'task_completed': 'CheckSquare',
      'manual': 'Play',
      'schedule': 'Clock'
    };
    return icons[triggerType] || 'Zap';
  }

  private static getActionLabel(actionType: string, actionConfig: Record<string, any>): string {
    const labels = {
      'create_deal': 'Create Deal',
      'update_deal_stage': 'Update Stage',
      'create_task': 'Create Task',
      'create_activity': 'Create Activity',
      'send_notification': 'Send Notification',
      'update_field': 'Update Field'
    };

    const baseLabel = labels[actionType] || actionType;
    
    // Add configuration details
    if (actionType === 'create_task' && actionConfig.task_title) {
      return `Create Task: ${actionConfig.task_title}`;
    }
    
    if (actionType === 'send_notification' && actionConfig.message) {
      return `Send: ${actionConfig.message.substring(0, 20)}...`;
    }

    return baseLabel;
  }

  private static getActionIcon(actionType: string): string {
    const icons = {
      'create_deal': 'Database',
      'update_deal_stage': 'ArrowRight',
      'create_task': 'CheckSquare',
      'create_activity': 'Activity',
      'send_notification': 'Bell',
      'update_field': 'Edit'
    };
    return icons[actionType] || 'Settings';
  }

  private static getConditionLabel(conditions: Record<string, any>): string {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return 'If Condition';
    
    const firstKey = keys[0];
    const firstValue = conditions[firstKey];
    
    if (typeof firstValue === 'object' && firstValue.operator) {
      return `If ${firstKey} ${firstValue.operator} ${firstValue.value}`;
    }
    
    return `If ${firstKey} = ${firstValue}`;
  }
}

// Export utility functions
export const workflowUtils = WorkflowUtils;