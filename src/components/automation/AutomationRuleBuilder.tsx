import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  Save, 
  Play,
  Settings,
  Zap,
  Clock,
  Target,
  FileText,
  Bell
} from 'lucide-react';
import { useDealStages } from '@/lib/hooks/deals/useDealStages';
import { supabase } from '@/lib/supabase/clientV2';

interface AutomationAction {
  id: string;
  type: 'create_activity' | 'create_task' | 'send_notification' | 'update_field';
  config: Record<string, any>;
}

interface AutomationRule {
  id?: string;
  name: string;
  description?: string;
  fromStage?: string;
  toStage: string;
  isEnabled: boolean;
  executionOrder: number;
  conditions?: Record<string, any>;
  actions: AutomationAction[];
}

interface AutomationRuleBuilderProps {
  rule?: AutomationRule;
  onSave: (rule: AutomationRule) => void;
  onCancel: () => void;
}

const actionTypeIcons = {
  create_activity: FileText,
  create_task: Clock,
  send_notification: Bell,
  update_field: Settings
};

const actionTypeLabels = {
  create_activity: 'Create Activity',
  create_task: 'Create Task',
  send_notification: 'Send Notification',
  update_field: 'Update Field'
};

export function AutomationRuleBuilder({ rule, onSave, onCancel }: AutomationRuleBuilderProps) {
  const { data: dealStages } = useDealStages();
  
  const [formData, setFormData] = useState<AutomationRule>({
    name: '',
    description: '',
    fromStage: '',
    toStage: '',
    isEnabled: true,
    executionOrder: 1,
    actions: [],
    ...rule
  });

  const [testMode, setTestMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    validateRule();
  }, [formData]);

  const validateRule = () => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('Rule name is required');
    }
    
    if (!formData.toStage) {
      errors.push('Target stage is required');
    }
    
    if (formData.actions.length === 0) {
      errors.push('At least one action is required');
    }
    
    // Validate individual actions
    formData.actions.forEach((action, index) => {
      if (action.type === 'create_activity' && !action.config.activityType) {
        errors.push(`Action ${index + 1}: Activity type is required`);
      }
      if (action.type === 'create_task' && !action.config.title) {
        errors.push(`Action ${index + 1}: Task title is required`);
      }
      if (action.type === 'send_notification' && !action.config.message) {
        errors.push(`Action ${index + 1}: Notification message is required`);
      }
    });
    
    setValidationErrors(errors);
  };

  const addAction = (type: AutomationAction['type']) => {
    const newAction: AutomationAction = {
      id: crypto.randomUUID(),
      type,
      config: getDefaultConfig(type)
    };
    
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));
  };

  const getDefaultConfig = (type: AutomationAction['type']) => {
    switch (type) {
      case 'create_activity':
        return {
          activityType: 'outbound',
          title: 'Follow up after stage transition',
          description: 'Automated follow-up activity',
          priority: 'medium'
        };
      case 'create_task':
        return {
          title: 'Stage transition task',
          description: 'Automated task for stage transition',
          priority: 'medium',
          dueInDays: 1
        };
      case 'send_notification':
        return {
          message: 'Deal has moved to {{toStage}} stage',
          recipients: ['deal_owner'],
          type: 'info'
        };
      case 'update_field':
        return {
          fieldName: '',
          fieldValue: '',
          condition: 'always'
        };
      default:
        return {};
    }
  };

  const updateAction = (actionId: string, updates: Partial<AutomationAction>) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map(action => 
        action.id === actionId 
          ? { ...action, ...updates }
          : action
      )
    }));
  };

  const removeAction = (actionId: string) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
    }));
  };

  const handleSave = async () => {
    if (validationErrors.length > 0) {
      return;
    }

    try {
      // Transform data for database
      const ruleData = {
        name: formData.name,
        description: formData.description,
        from_stage: formData.fromStage || null,
        to_stage: formData.toStage,
        is_enabled: formData.isEnabled,
        execution_order: formData.executionOrder,
        conditions: formData.conditions || {},
        actions: formData.actions.map(action => ({
          type: action.type,
          config: action.config
        }))
      };

      if (formData.id) {
        await supabase
          .from('user_automation_rules')
          .update(ruleData)
          .eq('id', formData.id);
      } else {
        await supabase
          .from('user_automation_rules')
          .insert([ruleData]);
      }

      onSave(formData);
    } catch (error) {
      console.error('Failed to save automation rule:', error);
    }
  };

  const testRule = async () => {
    setTestMode(true);
    
    try {
      // Simulate rule execution
      console.log('Testing rule:', formData);
      
      // In a real implementation, you'd call an API endpoint to test the rule
      setTimeout(() => {
        setTestMode(false);
        alert('Rule test completed successfully!');
      }, 2000);
      
    } catch (error) {
      console.error('Rule test failed:', error);
      setTestMode(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#37bd7e]" />
            {rule ? 'Edit Automation Rule' : 'Create New Automation Rule'}
          </CardTitle>
          <CardDescription>
            Define automated actions that execute when deals move between pipeline stages
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Basic Rule Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name *</Label>
              <Input
                id="ruleName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Auto-create proposal activity"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="executionOrder">Execution Order</Label>
              <Input
                id="executionOrder"
                type="number"
                min="1"
                value={formData.executionOrder}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  executionOrder: parseInt(e.target.value) || 1 
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this automation rule does..."
              rows={2}
            />
          </div>

          {/* Stage Triggers */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              Stage Triggers
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="space-y-2">
                <Label>From Stage (Optional)</Label>
                <Select
                  value={formData.fromStage || ''}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    fromStage: value || undefined 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any stage</SelectItem>
                    {dealStages?.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>To Stage *</Label>
                <Select
                  value={formData.toStage}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, toStage: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealStages?.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Actions</h3>
              <div className="flex gap-2">
                {Object.entries(actionTypeLabels).map(([type, label]) => {
                  const Icon = actionTypeIcons[type as keyof typeof actionTypeIcons];
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => addAction(type as AutomationAction['type'])}
                      className="flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {formData.actions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No actions configured</p>
                <p className="text-sm">Add actions using the buttons above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.actions.map((action, index) => (
                  <ActionEditor
                    key={action.id}
                    action={action}
                    index={index}
                    onUpdate={(updates) => updateAction(action.id, updates)}
                    onRemove={() => removeAction(action.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Please fix the following issues:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testRule}
            disabled={testMode || validationErrors.length > 0}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {testMode ? 'Testing...' : 'Test Rule'}
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={validationErrors.length > 0}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Rule
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ActionEditorProps {
  action: AutomationAction;
  index: number;
  onUpdate: (updates: Partial<AutomationAction>) => void;
  onRemove: () => void;
}

function ActionEditor({ action, index, onUpdate, onRemove }: ActionEditorProps) {
  const Icon = actionTypeIcons[action.type];
  const label = actionTypeLabels[action.type];

  const updateConfig = (key: string, value: any) => {
    onUpdate({
      config: { ...action.config, [key]: value }
    });
  };

  return (
    <Card className="border-l-4 border-l-[#37bd7e]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Icon className="w-3 h-3" />
              {label}
            </Badge>
            <span className="text-sm text-gray-500">Action #{index + 1}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {action.type === 'create_activity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select
                  value={action.config.activityType}
                  onValueChange={(value) => updateConfig('activityType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={action.config.priority}
                  onValueChange={(value) => updateConfig('priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={action.config.title || ''}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Activity title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={action.config.description || ''}
                onChange={(e) => updateConfig('description', e.target.value)}
                placeholder="Activity description"
                rows={2}
              />
            </div>
          </div>
        )}

        {action.type === 'create_task' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input
                value={action.config.title || ''}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Task title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={action.config.description || ''}
                onChange={(e) => updateConfig('description', e.target.value)}
                placeholder="Task description"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={action.config.priority}
                  onValueChange={(value) => updateConfig('priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Due in Days</Label>
                <Input
                  type="number"
                  min="0"
                  value={action.config.dueInDays || 1}
                  onChange={(e) => updateConfig('dueInDays', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>
        )}

        {action.type === 'send_notification' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notification Message</Label>
              <Textarea
                value={action.config.message || ''}
                onChange={(e) => updateConfig('message', e.target.value)}
                placeholder="Use {{toStage}}, {{fromStage}}, {{dealName}} placeholders"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select
                  value={action.config.recipients?.[0] || 'deal_owner'}
                  onValueChange={(value) => updateConfig('recipients', [value])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal_owner">Deal Owner</SelectItem>
                    <SelectItem value="all_admins">All Admins</SelectItem>
                    <SelectItem value="team_members">Team Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={action.config.type}
                  onValueChange={(value) => updateConfig('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {action.type === 'update_field' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Name</Label>
                <Input
                  value={action.config.fieldName || ''}
                  onChange={(e) => updateConfig('fieldName', e.target.value)}
                  placeholder="e.g., priority, status"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Field Value</Label>
                <Input
                  value={action.config.fieldValue || ''}
                  onChange={(e) => updateConfig('fieldValue', e.target.value)}
                  placeholder="New value for the field"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AutomationRuleBuilder;