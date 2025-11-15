import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Save, 
  Play, 
  X, 
  Target, 
  ArrowRight, 
  CheckSquare, 
  Activity, 
  Bell,
  ChevronDown,
  ChevronUp,
  Settings,
  Zap
} from 'lucide-react';

interface VisualWorkflowBuilderProps {
  workflow: any;
  isExpanded: boolean;
  onSave: (workflow: any) => void;
  onClose: () => void;
}

const TRIGGER_TYPES = [
  {
    id: 'pipeline_stage_changed',
    name: 'Pipeline Stage Change',
    icon: Target,
    color: 'bg-purple-600',
    description: 'When a deal moves between stages'
  },
  {
    id: 'activity_created',
    name: 'Activity Created',
    icon: Activity,
    color: 'bg-blue-600',
    description: 'When an activity is logged'
  },
  {
    id: 'task_completed',
    name: 'Task Completed',
    icon: CheckSquare,
    color: 'bg-green-600',
    description: 'When a task is marked complete'
  }
];

const ACTION_TYPES = [
  {
    id: 'create_task',
    name: 'Create Task',
    icon: CheckSquare,
    color: 'bg-[#37bd7e]',
    description: 'Generate a new task'
  },
  {
    id: 'create_activity',
    name: 'Create Activity',
    icon: Activity,
    color: 'bg-blue-600',
    description: 'Log a new activity'
  },
  {
    id: 'send_notification',
    name: 'Send Notification',
    icon: Bell,
    color: 'bg-yellow-600',
    description: 'Send an alert'
  }
];

const VisualWorkflowBuilder: React.FC<VisualWorkflowBuilderProps> = ({ 
  workflow, 
  isExpanded, 
  onSave, 
  onClose 
}) => {
  const [workflowData, setWorkflowData] = useState({
    name: '',
    description: '',
    trigger_type: 'pipeline_stage_changed',
    trigger_config: {},
    action_type: 'create_task',
    action_config: {},
    is_active: true
  });
  const [showConfig, setShowConfig] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (workflow) {
      setWorkflowData({
        name: workflow.rule_name || '',
        description: workflow.rule_description || '',
        trigger_type: workflow.trigger_type || 'pipeline_stage_changed',
        trigger_config: workflow.trigger_conditions || {},
        action_type: workflow.action_type || 'create_task',
        action_config: workflow.action_config || {},
        is_active: workflow.is_active !== false
      });
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [workflow]);

  const selectedTrigger = TRIGGER_TYPES.find(t => t.id === workflowData.trigger_type) || TRIGGER_TYPES[0];
  const selectedAction = ACTION_TYPES.find(a => a.id === workflowData.action_type) || ACTION_TYPES[0];

  const handleSave = () => {
    if (!workflowData.name.trim()) {
      alert('Please enter a workflow name');
      return;
    }
    onSave(workflowData);
  };

  const handleTest = () => {
    // Implement test logic here
  };

  if (!isExpanded) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a workflow or create a new one</p>
          <p className="text-xs mt-1">Visual workflow builder will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#37bd7e]" />
              <div>
                <input
                  type="text"
                  value={workflowData.name}
                  onChange={(e) => setWorkflowData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workflow name..."
                  className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-700 focus:border-[#37bd7e] text-white outline-none transition-colors"
                />
                <input
                  type="text"
                  value={workflowData.description}
                  onChange={(e) => setWorkflowData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add description..."
                  className="text-sm text-gray-400 bg-transparent border-b border-transparent hover:border-gray-700 focus:border-[#37bd7e] outline-none transition-colors w-full mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center"
              >
                <Play className="w-4 h-4 mr-2" />
                Test
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg text-sm transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Workflow */}
        <div className="p-8 bg-gray-950/30">
          <div className="flex items-center justify-center gap-8">
            {/* Trigger Node */}
            <div className="relative group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="cursor-pointer"
                onClick={() => setShowConfig(!showConfig)}
              >
                <div className={`w-32 h-32 ${selectedTrigger.color} rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white/10 group-hover:border-white/20 transition-all`}>
                  <selectedTrigger.icon className="w-12 h-12 text-white mb-2" />
                  <p className="text-xs text-white font-medium text-center px-2">
                    {selectedTrigger.name}
                  </p>
                </div>
              </motion.div>
              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <p className="text-xs text-gray-400">Trigger</p>
              </div>
            </div>

            {/* Connection Arrow */}
            <div className="relative">
              <svg width="80" height="4" className="overflow-visible">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="10"
                    refY="2"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 2, 0 4"
                      fill="#37bd7e"
                    />
                  </marker>
                </defs>
                <line
                  x1="0"
                  y1="2"
                  x2="70"
                  y2="2"
                  stroke="#37bd7e"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  strokeDasharray="5,5"
                  className="animate-pulse"
                />
              </svg>
            </div>

            {/* Action Node */}
            <div className="relative group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="cursor-pointer"
                onClick={() => setShowConfig(!showConfig)}
              >
                <div className={`w-32 h-32 ${selectedAction.color} rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white/10 group-hover:border-white/20 transition-all`}>
                  <selectedAction.icon className="w-12 h-12 text-white mb-2" />
                  <p className="text-xs text-white font-medium text-center px-2">
                    {selectedAction.name}
                  </p>
                </div>
              </motion.div>
              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <p className="text-xs text-gray-400">Action</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="border-t border-gray-800/50">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full p-4 hover:bg-gray-800/30 transition-colors flex items-center justify-between"
          >
            <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuration
            </span>
            {showConfig ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          
          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 grid lg:grid-cols-2 gap-6 border-t border-gray-800/50">
                  {/* Trigger Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      Trigger Settings
                    </h4>
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Trigger Type</label>
                      <select
                        value={workflowData.trigger_type}
                        onChange={(e) => setWorkflowData(prev => ({ ...prev, trigger_type: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      >
                        {TRIGGER_TYPES.map(trigger => (
                          <option key={trigger.id} value={trigger.id}>{trigger.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {workflowData.trigger_type === 'pipeline_stage_changed' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">From Stage</label>
                          <select className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors">
                            <option>Any Stage</option>
                            <option>SQL</option>
                            <option>Opportunity</option>
                            <option>Verbal</option>
                            <option>Signed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">To Stage</label>
                          <select className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors">
                            <option>Opportunity</option>
                            <option>Verbal</option>
                            <option>Signed</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#37bd7e]" />
                      Action Settings
                    </h4>
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Action Type</label>
                      <select
                        value={workflowData.action_type}
                        onChange={(e) => setWorkflowData(prev => ({ ...prev, action_type: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      >
                        {ACTION_TYPES.map(action => (
                          <option key={action.id} value={action.id}>{action.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {workflowData.action_type === 'create_task' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Task Title</label>
                          <input
                            type="text"
                            placeholder="e.g., Follow up with {{deal_name}}"
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Days After Trigger</label>
                          <input
                            type="number"
                            placeholder="3"
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VisualWorkflowBuilder;