/**
 * Node Factory Utility
 * Handles initialization of workflow nodes with default configurations
 */

import type { FormField } from '../nodes/FormNode';
import { formStorageService } from '@/lib/services/formStorageService';

export interface NodeInitializationConfig {
  type: string;
  nodeData: any;
  workflowId?: string | null;
}

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Initialize node data with default configurations based on node type
 */
export function initializeNodeData(
  type: string,
  nodeData: any,
  workflowId?: string | null
): any {
  let enhancedData = { ...nodeData };

  // Initialize multi_action node with default actions
  if (type === 'action' && nodeData.type === 'multi_action') {
    enhancedData = {
      ...nodeData,
      actions: [
        { type: 'create_task' },
        { type: 'send_notification' }
      ],
      executionMode: 'sequential'
    };
  }

  // Initialize router node with default configuration
  if (type === 'router') {
    enhancedData = {
      ...nodeData,
      routerType: 'stage',
      route_SQL: 'continue',
      route_Opportunity: 'action1',
      route_Verbal: 'action2',
      route_Signed: 'action3'
    };
  }

  // Initialize AI Agent node with default configuration
  if (type === 'aiAgent') {
    enhancedData = {
      ...nodeData,
      config: {
        modelProvider: 'openai',
        model: 'gpt-3.5-turbo',
        systemPrompt: 'You are a helpful AI assistant for a CRM system.',
        userPrompt: 'Process the following deal: {{deal.value}} for {{contact.name}}',
        temperature: 0.7,
        maxTokens: 1000
      }
    };
  }

  // Initialize Custom GPT node with default configuration
  if (type === 'customGPT') {
    enhancedData = {
      ...nodeData,
      config: {
        assistantId: '',
        createNewThread: true,
        message: 'Process the following data: {{formData.fields}}',
        temperature: 1.0,
        maxPromptTokens: 20000,
        maxCompletionTokens: 4000,
        responseFormat: 'text'
      }
    };
  }

  // Initialize Assistant Manager node with default configuration
  if (type === 'assistantManager') {
    enhancedData = {
      ...nodeData,
      config: {
        operation: 'create',
        assistantName: 'New Assistant',
        model: 'gpt-4-turbo-preview',
        instructions: 'You are a helpful assistant.',
        tools: {
          codeInterpreter: false,
          fileSearch: false
        },
        temperature: 1.0,
        topP: 1.0
      }
    };
  }

  // Initialize Form node with default configuration
  if (type === 'form') {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const testFormId = `form-test-${timestamp}-${randomStr}`;
    const prodFormId = `form-prod-${timestamp}-${randomStr}`;

    // Generate URLs
    const testUrl = `${window.location.origin}/form-test/${testFormId}`;
    const productionUrl = `${window.location.origin}/form/${prodFormId}`;

    // Create default configuration
    const defaultFormConfig = {
      formTitle: nodeData.label || 'New Form',
      formDescription: 'Please fill out this form',
      submitButtonText: 'Submit',
      fields: [
        {
          id: 'field-1',
          name: 'name',
          label: 'Name',
          type: 'text' as const,
          required: true,
          placeholder: 'Enter your name'
        },
        {
          id: 'field-2',
          name: 'email',
          label: 'Email',
          type: 'email' as const,
          required: true,
          placeholder: 'Enter your email'
        }
      ] as FormField[],
      authentication: 'none' as const,
      responseSettings: {
        onSubmit: 'continue' as const,
        successMessage: 'Thank you for your submission!',
        errorMessage: 'An error occurred. Please try again.'
      },
      testUrl,
      productionUrl
    };

    // Save form configurations immediately (async but don't wait)
    const currentWorkflowId = workflowId || crypto.randomUUID();
    formStorageService.storeFormConfig(testFormId, defaultFormConfig, currentWorkflowId, true);
    formStorageService.storeFormConfig(prodFormId, defaultFormConfig, currentWorkflowId, false);

    enhancedData = {
      ...enhancedData,
      config: defaultFormConfig
    };
  }

  // Initialize condition nodes based on their type
  if (type === 'condition') {
    if (nodeData.type === 'if_value') {
      enhancedData = {
        ...nodeData,
        conditionType: 'field',
        fieldName: 'deal_value',
        fieldOperator: '>',
        fieldValue: '10000',
        condition: 'deal_value > 10000'
      };
    } else if (nodeData.type === 'if_stage') {
      enhancedData = {
        ...nodeData,
        conditionType: 'stage',
        stageCondition: 'Opportunity',
        condition: 'stage = Opportunity'
      };
    } else if (nodeData.type === 'if_time') {
      enhancedData = {
        ...nodeData,
        conditionType: 'custom',
        condition: 'days_in_stage > 7'
      };
    } else if (nodeData.type === 'if_user') {
      enhancedData = {
        ...nodeData,
        conditionType: 'owner',
        condition: 'owner = current_user'
      };
    } else if (nodeData.type === 'time_since_contact') {
      enhancedData = {
        ...nodeData,
        conditionType: 'time_since_contact',
        timeComparison: 'greater_than',
        daysSinceContact: 7,
        condition: 'days_since_contact > 7'
      };
    } else if (nodeData.type === 'if_custom_field') {
      enhancedData = {
        ...nodeData,
        conditionType: 'custom_field',
        customFieldName: '',
        customFieldOperator: 'equals',
        customFieldValue: '',
        condition: 'custom_field = value'
      };
    }
  }

  return enhancedData;
}

/**
 * Calculate node position based on viewport center
 */
export function calculateNodePosition(
  viewportX: number,
  viewportY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): NodePosition {
  const centerX = (-viewportX + canvasWidth / 2) / zoom;
  const centerY = (-viewportY + canvasHeight / 2) / zoom;

  return {
    x: centerX - 72, // Adjust centering for larger default node width (~144px)
    y: centerY - 36  // Adjust centering for larger default node height (~72px)
  };
}

/**
 * Create a new workflow node with initialized data
 */
export function createWorkflowNode(
  config: NodeInitializationConfig,
  position: NodePosition
): any {
  const nodeId = `${config.type}_${Date.now()}`;
  const enhancedData = initializeNodeData(
    config.type,
    config.nodeData,
    config.workflowId
  );

  return {
    id: nodeId,
    type: config.type,
    position,
    data: enhancedData,
  };
}

