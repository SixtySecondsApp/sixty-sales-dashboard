// Workflow AI Suggestions Generator
// Generates intelligent title and description suggestions based on workflow configuration

interface WorkflowNode {
  type: string;
  data: {
    label: string;
    trigger_type?: string;
    action_type?: string;
    condition?: any;
    [key: string]: any;
  };
}

interface WorkflowSuggestion {
  name: string;
  description: string;
}

export class WorkflowSuggestionGenerator {
  static generateSuggestions(nodes: WorkflowNode[], edges: any[]): WorkflowSuggestion {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const actionNodes = nodes.filter(n => n.type === 'action');
    const conditionNodes = nodes.filter(n => n.type === 'condition');
    
    // If no nodes, return default
    if (!triggerNode && actionNodes.length === 0) {
      return {
        name: 'New Workflow',
        description: 'Configure triggers and actions to automate your workflow'
      };
    }
    
    // Generate name based on trigger and primary action
    const name = this.generateName(triggerNode, actionNodes, conditionNodes);
    
    // Generate description based on full workflow
    const description = this.generateDescription(triggerNode, actionNodes, conditionNodes);
    
    return { name, description };
  }
  
  private static generateName(
    triggerNode: WorkflowNode | undefined,
    actionNodes: WorkflowNode[],
    conditionNodes: WorkflowNode[]
  ): string {
    const nameParts: string[] = [];
    
    // Add trigger context
    if (triggerNode) {
      const triggerType = triggerNode.data.trigger_type || triggerNode.data.label;
      const triggerNames: { [key: string]: string } = {
        'deal_created': 'New Deal',
        'deal_stage_change': 'Deal Stage Change',
        'task_due': 'Task Due',
        'activity_created': 'New Activity',
        'contact_updated': 'Contact Update',
        'schedule': 'Scheduled',
        'webhook': 'Webhook',
        'email_received': 'Email Received',
        'form_submission': 'Form Submission'
      };
      
      nameParts.push(triggerNames[triggerType] || this.formatLabel(triggerType));
    }
    
    // Add primary action
    if (actionNodes.length > 0) {
      const primaryAction = actionNodes[0];
      const actionType = primaryAction.data.action_type || primaryAction.data.label;
      const actionNames: { [key: string]: string } = {
        'create_task': 'Task Creation',
        'send_email': 'Email Notification',
        'update_deal': 'Deal Update',
        'slack_message': 'Slack Alert',
        'webhook': 'Webhook',
        'create_activity': 'Activity Logging',
        'assign_user': 'User Assignment',
        'add_tag': 'Auto-Tagging',
        'generate_document': 'Document Generation'
      };
      
      if (nameParts.length > 0) {
        nameParts.push('→');
      }
      nameParts.push(actionNames[actionType] || this.formatLabel(actionType));
    }
    
    // Add condition context if complex
    if (conditionNodes.length > 1) {
      nameParts.push('(Multi-Path)');
    } else if (conditionNodes.length === 1) {
      nameParts.push('(Conditional)');
    }
    
    // If name is too long, simplify
    const fullName = nameParts.join(' ');
    if (fullName.length > 50) {
      // Fallback to simpler name
      const trigger = triggerNode?.data.label || 'Trigger';
      const action = actionNodes[0]?.data.label || 'Action';
      return `${this.formatLabel(trigger)} Automation`;
    }
    
    return fullName || 'Custom Workflow';
  }
  
  private static generateDescription(
    triggerNode: WorkflowNode | undefined,
    actionNodes: WorkflowNode[],
    conditionNodes: WorkflowNode[]
  ): string {
    const descParts: string[] = [];
    
    // Describe trigger
    if (triggerNode) {
      const triggerType = triggerNode.data.trigger_type || triggerNode.data.label;
      const triggerDesc = this.getTriggerDescription(triggerType, triggerNode.data);
      descParts.push(`Triggers ${triggerDesc}`);
    }
    
    // Describe conditions
    if (conditionNodes.length > 0) {
      if (conditionNodes.length === 1) {
        const condition = conditionNodes[0].data.condition || conditionNodes[0].data.label;
        descParts.push(`Checks if ${this.formatLabel(condition)}`);
      } else {
        descParts.push(`Evaluates ${conditionNodes.length} conditions`);
      }
    }
    
    // Describe actions
    if (actionNodes.length > 0) {
      const actionDescriptions = actionNodes.map(node => {
        const actionType = node.data.action_type || node.data.label;
        return this.getActionDescription(actionType, node.data);
      });
      
      if (actionNodes.length === 1) {
        descParts.push(`Then ${actionDescriptions[0]}`);
      } else {
        descParts.push(`Then performs ${actionNodes.length} actions: ${actionDescriptions.join(', ')}`);
      }
    }
    
    // Add workflow benefit/purpose
    const benefit = this.inferWorkflowBenefit(triggerNode, actionNodes, conditionNodes);
    if (benefit) {
      descParts.push(benefit);
    }
    
    return descParts.join('. ') + '.';
  }
  
  private static getTriggerDescription(triggerType: string, data: any): string {
    const descriptions: { [key: string]: string } = {
      'deal_created': 'when a new deal is created',
      'deal_stage_change': 'when a deal moves to a new stage',
      'task_due': 'when a task is due',
      'activity_created': 'when a new activity is logged',
      'contact_updated': 'when a contact is updated',
      'schedule': `on a schedule${data.schedule ? ` (${data.schedule})` : ''}`,
      'webhook': 'when a webhook is received',
      'email_received': 'when an email is received',
      'form_submission': 'when a form is submitted'
    };
    
    return descriptions[triggerType] || `on ${this.formatLabel(triggerType)}`;
  }
  
  private static getActionDescription(actionType: string, data: any): string {
    const descriptions: { [key: string]: string } = {
      'create_task': 'creates a follow-up task',
      'send_email': 'sends an email notification',
      'update_deal': 'updates the deal',
      'slack_message': 'sends a Slack message',
      'webhook': 'triggers a webhook',
      'create_activity': 'logs an activity',
      'assign_user': 'assigns to a team member',
      'add_tag': 'adds tags',
      'generate_document': 'generates a document'
    };
    
    return descriptions[actionType] || this.formatLabel(actionType);
  }
  
  private static inferWorkflowBenefit(
    triggerNode: WorkflowNode | undefined,
    actionNodes: WorkflowNode[],
    conditionNodes: WorkflowNode[]
  ): string {
    // Infer the benefit based on common patterns
    const hasTask = actionNodes.some(n => n.data.action_type === 'create_task');
    const hasNotification = actionNodes.some(n => 
      n.data.action_type === 'send_email' || n.data.action_type === 'slack_message'
    );
    const hasUpdate = actionNodes.some(n => 
      n.data.action_type === 'update_deal' || n.data.action_type === 'assign_user'
    );
    
    if (hasTask && hasNotification) {
      return 'Ensures timely follow-up and team awareness';
    } else if (hasTask) {
      return 'Automates follow-up task creation to prevent missed opportunities';
    } else if (hasNotification) {
      return 'Keeps your team informed in real-time';
    } else if (hasUpdate) {
      return 'Streamlines your pipeline management';
    } else if (conditionNodes.length > 0) {
      return 'Intelligently routes based on your business rules';
    }
    
    return '';
  }
  
  private static formatLabel(label: string): string {
    if (!label) return '';
    
    // Convert snake_case or kebab-case to Title Case
    return label
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Generate suggestions for common workflow patterns
  static getCommonPatterns(): Array<{ name: string; description: string; pattern: string }> {
    return [
      {
        name: 'Lead Follow-up Automation',
        description: 'Automatically create follow-up tasks when new leads are added',
        pattern: 'lead_followup'
      },
      {
        name: 'Deal Stage Notification',
        description: 'Notify team members when deals reach critical stages',
        pattern: 'stage_notification'
      },
      {
        name: 'Customer Onboarding',
        description: 'Automate the customer onboarding process with tasks and emails',
        pattern: 'onboarding'
      },
      {
        name: 'Stale Deal Alert',
        description: 'Alert sales reps when deals haven\'t moved in X days',
        pattern: 'stale_alert'
      },
      {
        name: 'Win/Loss Analysis',
        description: 'Trigger analysis workflow when deals are won or lost',
        pattern: 'win_loss'
      }
    ];
  }
}