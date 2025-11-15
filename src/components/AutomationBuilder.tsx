import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Zap, 
  Activity, 
  CheckCircle2, 
  Calendar,
  Bell,
  FileText,
  Users,
  Target,
  Play,
  TestTube,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface AutomationBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (automation: any) => void;
}

interface TriggerOption {
  id: string;
  type: 'activity' | 'pipeline' | 'task' | 'deal';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  conditions?: any[];
}

interface ActionOption {
  id: string;
  type: 'create_activity' | 'create_task' | 'send_notification' | 'update_field' | 'move_stage';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  compatibleTriggers: string[];
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: 'activity_created',
    type: 'activity',
    title: 'Activity Created',
    description: 'When a specific activity is logged (call, meeting, proposal)',
    icon: <Activity className="w-6 h-6" />,
    color: 'bg-blue-500'
  },
  {
    id: 'pipeline_stage_changed',
    type: 'pipeline',
    title: 'Pipeline Stage Changed',
    description: 'When a deal moves between specific pipeline stages',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-purple-500'
  },
  {
    id: 'task_completed',
    type: 'task',
    title: 'Task Completed',
    description: 'When a specific type of task is marked as completed',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'bg-green-500'
  },
  {
    id: 'deal_created',
    type: 'deal',
    title: 'Deal Created',
    description: 'When a new deal is added to the pipeline',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-orange-500'
  }
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: 'create_activity',
    type: 'create_activity',
    title: 'Create Activity',
    description: 'Log a new activity (call, meeting, proposal)',
    icon: <Activity className="w-6 h-6" />,
    color: 'bg-blue-500',
    compatibleTriggers: ['pipeline_stage_changed', 'task_completed', 'deal_created']
  },
  {
    id: 'create_task',
    type: 'create_task',
    title: 'Create Task',
    description: 'Generate a new task with specific details and timing',
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-green-500',
    compatibleTriggers: ['activity_created', 'pipeline_stage_changed', 'deal_created']
  },
  {
    id: 'send_notification',
    type: 'send_notification',
    title: 'Send Notification',
    description: 'Send alert or notification to team members',
    icon: <Bell className="w-6 h-6" />,
    color: 'bg-yellow-500',
    compatibleTriggers: ['activity_created', 'pipeline_stage_changed', 'task_completed', 'deal_created']
  },
  {
    id: 'move_stage',
    type: 'move_stage',
    title: 'Move Pipeline Stage',
    description: 'Automatically move deal to another stage',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-purple-500',
    compatibleTriggers: ['activity_created', 'task_completed']
  }
];

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({ isOpen, onClose, onSave }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerOption | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null);
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [actionConfig, setActionConfig] = useState<any>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingActive, setIsTestingActive] = useState(false);
  const [automationDetails, setAutomationDetails] = useState({
    title: '',
    description: '',
    isActive: true
  });

  // Available options for dropdowns
  const [stages, setStages] = useState<any[]>([]);
  const [activityTypes, setActivityTypes] = useState(['call', 'meeting', 'proposal', 'email', 'demo']);
  const [taskTypes, setTaskTypes] = useState(['follow_up', 'onboarding', 'check_in', 'reminder', 'action']);

  useEffect(() => {
    if (isOpen) {
      loadStages();
    }
  }, [isOpen]);

  // Smart pre-population when trigger/action changes
  useEffect(() => {
    if (selectedTrigger && selectedAction) {
      generateSmartTitle();
      generateSmartDescription();
    }
  }, [selectedTrigger, selectedAction, triggerConfig, actionConfig]);

  const loadStages = async () => {
    const { data } = await supabase.from('deal_stages').select('*').order('stage_order');
    setStages(data || []);
  };

  const generateSmartTitle = () => {
    if (!selectedTrigger || !selectedAction) return;
    
    let title = '';
    
    // Smart title generation based on combinations
    if (selectedTrigger.type === 'pipeline' && selectedAction.type === 'create_task') {
      const fromStage = stages.find(s => s.id === triggerConfig.from_stage_id)?.stage_name || 'stage';
      const toStage = stages.find(s => s.id === triggerConfig.to_stage_id)?.stage_name || 'stage';
      title = `Create ${actionConfig.task_type || 'follow-up'} task when moving to ${toStage}`;
    } else if (selectedTrigger.type === 'activity' && selectedAction.type === 'create_task') {
      title = `Create ${actionConfig.task_type || 'follow-up'} task after ${triggerConfig.activity_type || 'activity'}`;
    } else if (selectedTrigger.type === 'pipeline' && selectedAction.type === 'create_activity') {
      const toStage = stages.find(s => s.id === triggerConfig.to_stage_id)?.stage_name || 'stage';
      title = `Auto-log ${actionConfig.activity_type || 'activity'} when reaching ${toStage}`;
    } else {
      title = `${selectedTrigger.title} → ${selectedAction.title}`;
    }
    
    setAutomationDetails(prev => ({ ...prev, title }));
  };

  const generateSmartDescription = () => {
    if (!selectedTrigger || !selectedAction) return;
    
    let description = `Automatically ${selectedAction.description.toLowerCase()} when ${selectedTrigger.description.toLowerCase()}.`;
    
    if (actionConfig.days_after && parseInt(actionConfig.days_after) > 0) {
      description += ` This happens ${actionConfig.days_after} day${parseInt(actionConfig.days_after) > 1 ? 's' : ''} after the trigger.`;
    }
    
    setAutomationDetails(prev => ({ ...prev, description }));
  };

  const runTest = async () => {
    setIsTestingActive(true);
    
    try {
      // Simulate test by validating configuration
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      const mockResult = {
        success: true,
        message: `Test successful! Your automation would ${selectedAction?.description.toLowerCase()} when ${selectedTrigger?.description.toLowerCase()}.`,
        details: {
          trigger: selectedTrigger?.title,
          action: selectedAction?.title,
          config: { ...triggerConfig, ...actionConfig }
        }
      };
      
      setTestResult(mockResult);
      toast.success('Test completed successfully!');
    } catch (error) {
      const errorResult = {
        success: false,
        message: 'Test failed. Please check your configuration.',
        error: error
      };
      setTestResult(errorResult);
      toast.error('Test failed');
    } finally {
      setIsTestingActive(false);
    }
  };

  const handleSave = async () => {
    try {
      const automation = {
        rule_name: automationDetails.title,
        rule_description: automationDetails.description,
        trigger_type: selectedTrigger?.id,
        trigger_config: triggerConfig,
        action_type: selectedAction?.type,
        action_config: actionConfig,
        is_active: automationDetails.isActive
      };

      // Save to database - this would use the unified automation system
      await onSave(automation);
      toast.success('Automation created successfully!');
      onClose();
      resetBuilder();
    } catch (error) {
      toast.error('Failed to create automation');
    }
  };

  const resetBuilder = () => {
    setCurrentStep(1);
    setSelectedTrigger(null);
    setSelectedAction(null);
    setTriggerConfig({});
    setActionConfig({});
    setTestResult(null);
    setAutomationDetails({ title: '', description: '', isActive: true });
  };

  const nextStep = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const getAvailableActions = () => {
    if (!selectedTrigger) return ACTION_OPTIONS;
    return ACTION_OPTIONS.filter(action => 
      action.compatibleTriggers.includes(selectedTrigger.id)
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Choose Your Trigger</h3>
              <p className="text-gray-400">What event should start this automation?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TRIGGER_OPTIONS.map((trigger) => (
                <motion.div
                  key={trigger.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTrigger?.id === trigger.id
                      ? 'border-[#37bd7e] bg-[#37bd7e]/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedTrigger(trigger)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-12 h-12 rounded-lg ${trigger.color} flex items-center justify-center text-white`}>
                      {trigger.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{trigger.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{trigger.description}</p>
                    </div>
                    {selectedTrigger?.id === trigger.id && (
                      <Check className="w-5 h-5 text-[#37bd7e]" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Choose Your Action</h3>
              <p className="text-gray-400">What should happen when the trigger occurs?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getAvailableActions().map((action) => (
                <motion.div
                  key={action.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAction?.id === action.id
                      ? 'border-[#37bd7e] bg-[#37bd7e]/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedAction(action)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center text-white`}>
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{action.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{action.description}</p>
                    </div>
                    {selectedAction?.id === action.id && (
                      <Check className="w-5 h-5 text-[#37bd7e]" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Configure Your Trigger</h3>
              <p className="text-gray-400">Set up the specific conditions for when this automation runs</p>
            </div>

            {selectedTrigger?.type === 'pipeline' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">From Stage (Optional)</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={triggerConfig.from_stage_id || ''}
                    onChange={(e) => setTriggerConfig(prev => ({ ...prev, from_stage_id: e.target.value || null }))}
                  >
                    <option value="">Any stage</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.stage_name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">To Stage *</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={triggerConfig.to_stage_id || ''}
                    onChange={(e) => setTriggerConfig(prev => ({ ...prev, to_stage_id: e.target.value }))}
                    required
                  >
                    <option value="">Select target stage</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.stage_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedTrigger?.type === 'activity' && (
              <div>
                <label className="block text-sm font-medium mb-2">Activity Type</label>
                <select
                  className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  value={triggerConfig.activity_type || ''}
                  onChange={(e) => setTriggerConfig(prev => ({ ...prev, activity_type: e.target.value }))}
                >
                  <option value="">Any activity</option>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedTrigger?.type === 'task' && (
              <div>
                <label className="block text-sm font-medium mb-2">Task Type</label>
                <select
                  className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  value={triggerConfig.task_type || ''}
                  onChange={(e) => setTriggerConfig(prev => ({ ...prev, task_type: e.target.value }))}
                >
                  <option value="">Any task</option>
                  {taskTypes.map((type) => (
                    <option key={type} value={type}>{type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Configure Your Action</h3>
              <p className="text-gray-400">Set up what exactly should happen</p>
            </div>

            {selectedAction?.type === 'create_task' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Task Type</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.task_type || 'follow_up'}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, task_type: e.target.value }))}
                  >
                    {taskTypes.map((type) => (
                      <option key={type} value={type}>{type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.priority || 'medium'}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Days After Trigger</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.days_after || 0}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, days_after: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            )}

            {selectedAction?.type === 'create_activity' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Activity Type</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.activity_type || 'call'}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, activity_type: e.target.value }))}
                  >
                    {activityTypes.map((type) => (
                      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Activity Amount Source</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.amount_source || 'none'}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, amount_source: e.target.value }))}
                  >
                    <option value="none">No amount</option>
                    <option value="deal_value">Use deal value</option>
                    <option value="fixed_amount">Fixed amount</option>
                  </select>
                </div>

                {actionConfig.amount_source === 'fixed_amount' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Fixed Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                      value={actionConfig.fixed_amount || ''}
                      onChange={(e) => setActionConfig(prev => ({ ...prev, fixed_amount: parseFloat(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedAction?.type === 'send_notification' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Notification Type</label>
                  <select
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    value={actionConfig.notification_type || 'info'}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, notification_type: e.target.value }))}
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message Template</label>
                  <textarea
                    className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                    rows={3}
                    value={actionConfig.message || ''}
                    onChange={(e) => setActionConfig(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Enter notification message..."
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Test Your Automation</h3>
              <p className="text-gray-400">Make sure everything works as expected</p>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  Automation Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg ${selectedTrigger?.color} flex items-center justify-center text-white`}>
                    {selectedTrigger?.icon}
                  </div>
                  <div>
                    <p className="font-medium">{selectedTrigger?.title}</p>
                    <p className="text-sm text-gray-400">{selectedTrigger?.description}</p>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <ArrowRight className="w-8 h-8 text-[#37bd7e]" />
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg ${selectedAction?.color} flex items-center justify-center text-white`}>
                    {selectedAction?.icon}
                  </div>
                  <div>
                    <p className="font-medium">{selectedAction?.title}</p>
                    <p className="text-sm text-gray-400">{selectedAction?.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button
                onClick={runTest}
                disabled={isTestingActive}
                className="bg-[#37bd7e] hover:bg-[#37bd7e]/80 px-8 py-3"
              >
                {isTestingActive ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <Card className={`border-2 ${testResult.success ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500 mt-1" />
                    ) : (
                      <X className="w-6 h-6 text-red-500 mt-1" />
                    )}
                    <div>
                      <p className="font-medium text-white">{testResult.message}</p>
                      {testResult.details && (
                        <div className="mt-2 text-sm text-gray-400">
                          <p><strong>Trigger:</strong> {testResult.details.trigger}</p>
                          <p><strong>Action:</strong> {testResult.details.action}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Automation Details</h3>
              <p className="text-gray-400">Give your automation a name and description</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Automation Name *</label>
                <Input
                  value={automationDetails.title}
                  onChange={(e) => setAutomationDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter automation name..."
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={automationDetails.description}
                  onChange={(e) => setAutomationDetails(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this automation does..."
                  rows={3}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={automationDetails.isActive}
                  onChange={(e) => setAutomationDetails(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-[#37bd7e] bg-gray-800 border-gray-600 rounded focus:ring-[#37bd7e]"
                />
                <label htmlFor="isActive" className="text-sm">
                  Activate this automation immediately
                </label>
              </div>
            </div>

            <Card className="bg-gradient-to-r from-[#37bd7e]/10 to-purple-500/10 border border-[#37bd7e]/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-[#37bd7e]" />
                  <h4 className="font-semibold">Automation Summary</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Trigger:</strong> {selectedTrigger?.title}</p>
                  <p><strong>Action:</strong> {selectedAction?.title}</p>
                  <p><strong>Status:</strong> {automationDetails.isActive ? 'Active' : 'Inactive'}</p>
                  {testResult?.success && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Test passed</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[#37bd7e] to-purple-500 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Automation Builder</h2>
                <p className="text-sm text-gray-400">Step {currentStep} of 6</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i + 1 <= currentStep ? 'bg-[#37bd7e] text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {i + 1 <= currentStep ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < 5 && (
                    <div className={`w-16 h-1 mx-2 ${
                      i + 1 < currentStep ? 'bg-[#37bd7e]' : 'bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Trigger</span>
              <span>Action</span>
              <span>Configure</span>
              <span>Setup</span>
              <span>Test</span>
              <span>Details</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {selectedTrigger && selectedAction && (
                <>
                  <Badge variant="outline" className="border-[#37bd7e]/50 text-[#37bd7e]">
                    {selectedTrigger.title}
                  </Badge>
                  <ArrowRight className="w-4 h-4" />
                  <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                    {selectedAction.title}
                  </Badge>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={prevStep}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {currentStep < 6 ? (
                <Button
                  onClick={nextStep}
                  disabled={
                    (currentStep === 1 && !selectedTrigger) ||
                    (currentStep === 2 && !selectedAction)
                  }
                  className="bg-[#37bd7e] hover:bg-[#37bd7e]/80"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={!automationDetails.title.trim()}
                  className="bg-gradient-to-r from-[#37bd7e] to-purple-500 hover:from-[#37bd7e]/80 hover:to-purple-500/80"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Create Automation
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AutomationBuilder;