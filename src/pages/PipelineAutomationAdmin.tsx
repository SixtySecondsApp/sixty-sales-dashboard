import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Zap,
  Activity,
  CheckSquare,
  Bell,
  Settings,
  ArrowRight,
  Play,
  Pause
} from 'lucide-react';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useAuth } from '@/lib/contexts/AuthContext';

interface DealStage {
  id: string;
  name: string;
  color: string;
  order_position: number;
}

interface PipelineAutomationRule {
  id?: string;
  rule_name: string;
  rule_description?: string;
  from_stage_id?: string;
  to_stage_id: string;
  action_type: 'create_activity' | 'create_task' | 'send_notification' | 'update_field';
  
  // Activity parameters
  activity_type?: string;
  activity_title?: string;
  activity_details?: string;
  activity_amount_source?: 'deal_value' | 'fixed_amount' | 'none';
  activity_fixed_amount?: number;
  
  // Task parameters
  task_title?: string;
  task_description?: string;
  task_type?: string;
  task_priority?: string;
  task_days_after?: number;
  
  // Metadata
  is_active: boolean;
  execution_order: number;
  created_at?: string;
  updated_at?: string;
}

const ACTION_TYPES = [
  { value: 'create_activity', label: 'Create Activity', icon: Activity, color: 'text-blue-400' },
  { value: 'create_task', label: 'Create Task', icon: CheckSquare, color: 'text-green-400' },
  { value: 'send_notification', label: 'Send Notification', icon: Bell, color: 'text-yellow-400' },
  { value: 'update_field', label: 'Update Field', icon: Settings, color: 'text-purple-400' },
];

const ACTIVITY_TYPES = [
  { value: 'proposal', label: 'Proposal Sent', icon: '📄' },
  { value: 'meeting', label: 'Meeting Scheduled', icon: '📅' },
  { value: 'call', label: 'Call Made', icon: '📞' },
  { value: 'demo', label: 'Demo Completed', icon: '🖥️' },
  { value: 'email', label: 'Email Sent', icon: '✉️' },
  { value: 'follow_up', label: 'Follow Up', icon: '🔄' },
];

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'check_in', label: 'Check In' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'action', label: 'Action Required' },
];

const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

export default function PipelineAutomationAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stages, setStages] = useState<DealStage[]>([]);
  const [rules, setRules] = useState<PipelineAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState<PipelineAutomationRule>({
    rule_name: '',
    rule_description: '',
    from_stage_id: '',
    to_stage_id: '',
    action_type: 'create_activity',
    activity_type: 'proposal',
    activity_title: '',
    activity_details: '',
    activity_amount_source: 'none',
    activity_fixed_amount: 0,
    task_title: '',
    task_description: '',
    task_type: 'follow_up',
    task_priority: 'medium',
    task_days_after: 3,
    is_active: true,
    execution_order: 0,
  });

  useEffect(() => {
    checkAdminAccess();
    fetchStages();
    fetchRules();
  }, []);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserData(profile);
      if (!isUserAdmin(profile)) {
        toast.error('Admin access required');
        navigate('/');
      }
    }
  };

  const fetchStages = async () => {
    try {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('order_position', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error('Error fetching stages:', error);
      toast.error('Failed to load pipeline stages');
    }
  };

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_automation_rules')
        .select('*')
        .order('execution_order', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const dataToSave = { ...formData };
      delete dataToSave.id;
      delete dataToSave.created_at;
      delete dataToSave.updated_at;

      // Clean up unused fields based on action type
      if (dataToSave.action_type !== 'create_activity') {
        dataToSave.activity_type = null;
        dataToSave.activity_title = null;
        dataToSave.activity_details = null;
        dataToSave.activity_amount_source = null;
        dataToSave.activity_fixed_amount = null;
      }

      if (dataToSave.action_type !== 'create_task') {
        dataToSave.task_title = null;
        dataToSave.task_description = null;
        dataToSave.task_type = null;
        dataToSave.task_priority = null;
        dataToSave.task_days_after = null;
      }

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('pipeline_automation_rules')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Automation rule updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('pipeline_automation_rules')
          .insert([{ ...dataToSave, created_by: user?.id }]);

        if (error) throw error;
        toast.success('Automation rule created successfully');
      }

      setEditingId(null);
      setShowNewForm(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      if (error.message?.includes('unique_rule_name_per_transition')) {
        toast.error('A rule with this name already exists for this stage transition');
      } else {
        toast.error('Failed to save automation rule');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      const { error } = await supabase
        .from('pipeline_automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Automation rule deleted successfully');
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete automation rule');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('pipeline_automation_rules')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Automation rule ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule status');
    }
  };

  const startEdit = (rule: PipelineAutomationRule) => {
    setFormData(rule);
    setEditingId(rule.id!);
    setShowNewForm(false);
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_description: '',
      from_stage_id: '',
      to_stage_id: '',
      action_type: 'create_activity',
      activity_type: 'proposal',
      activity_title: '',
      activity_details: '',
      activity_amount_source: 'none',
      activity_fixed_amount: 0,
      task_title: '',
      task_description: '',
      task_type: 'follow_up',
      task_priority: 'medium',
      task_days_after: 3,
      is_active: true,
      execution_order: 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    resetForm();
  };

  const getActionIcon = (actionType: string) => {
    const actionConfig = ACTION_TYPES.find(a => a.value === actionType);
    return actionConfig ? actionConfig.icon : Activity;
  };

  const getActionColor = (actionType: string) => {
    const actionConfig = ACTION_TYPES.find(a => a.value === actionType);
    return actionConfig ? actionConfig.color : 'text-gray-400';
  };

  const getStageName = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage ? stage.name : 'Any Stage';
  };

  const getPriorityClass = (priority: string) => {
    return TASK_PRIORITIES.find(p => p.value === priority)?.color || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="mb-4 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-purple-400" />
                Smart Pipeline Automation
              </h1>
              <p className="text-gray-400 mt-2">
                Configure automated actions when deals move between pipeline stages
              </p>
            </div>
            
            {!showNewForm && !editingId && (
              <button
                onClick={() => setShowNewForm(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Automation Rule
              </button>
            )}
          </div>
        </div>

        {/* New/Edit Form */}
        {(showNewForm || editingId) && (
          <div className="mb-8 p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingId ? 'Edit Automation Rule' : 'Create New Automation Rule'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  placeholder="e.g., Auto-create proposal activity"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Action Type *
                </label>
                <select
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  {ACTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Stage */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  From Stage (Optional)
                </label>
                <select
                  value={formData.from_stage_id || ''}
                  onChange={(e) => setFormData({ ...formData, from_stage_id: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Any Stage</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* To Stage */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  To Stage *
                </label>
                <select
                  value={formData.to_stage_id}
                  onChange={(e) => setFormData({ ...formData, to_stage_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select target stage...</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity-specific fields */}
              {formData.action_type === 'create_activity' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Activity Type *
                    </label>
                    <select
                      value={formData.activity_type || ''}
                      onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      {ACTIVITY_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Activity Title *
                    </label>
                    <input
                      type="text"
                      value={formData.activity_title || ''}
                      onChange={(e) => setFormData({ ...formData, activity_title: e.target.value })}
                      placeholder="e.g., Proposal sent"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount Source
                    </label>
                    <select
                      value={formData.activity_amount_source || 'none'}
                      onChange={(e) => setFormData({ ...formData, activity_amount_source: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="none">No Amount</option>
                      <option value="deal_value">Use Deal Value</option>
                      <option value="fixed_amount">Fixed Amount</option>
                    </select>
                  </div>

                  {formData.activity_amount_source === 'fixed_amount' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Fixed Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.activity_fixed_amount || 0}
                        onChange={(e) => setFormData({ ...formData, activity_fixed_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Task-specific fields */}
              {formData.action_type === 'create_task' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      value={formData.task_title || ''}
                      onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                      placeholder="e.g., Follow up on proposal"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Task Type
                    </label>
                    <select
                      value={formData.task_type || 'follow_up'}
                      onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {TASK_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.task_priority || 'medium'}
                      onChange={(e) => setFormData({ ...formData, task_priority: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {TASK_PRIORITIES.map(priority => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Days After Transition
                    </label>
                    <input
                      type="number"
                      value={formData.task_days_after || 0}
                      onChange={(e) => setFormData({ ...formData, task_days_after: parseInt(e.target.value) || 0 })}
                      min="0"
                      max="90"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </>
              )}

              {/* Execution Order */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Execution Order
                </label>
                <input
                  type="number"
                  value={formData.execution_order}
                  onChange={(e) => setFormData({ ...formData, execution_order: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Is Active */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-white">Active</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.rule_description || ''}
                  onChange={(e) => setFormData({ ...formData, rule_description: e.target.value })}
                  placeholder="Describe what this automation rule does..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.rule_name || !formData.to_stage_id || 
                  (formData.action_type === 'create_activity' && (!formData.activity_type || !formData.activity_title)) ||
                  (formData.action_type === 'create_task' && !formData.task_title)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg">
              <Zap className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No pipeline automation rules configured yet</p>
              <p className="text-sm text-gray-500 mt-2">Create your first rule to start automating your pipeline</p>
            </div>
          ) : (
            rules.map((rule) => {
              const ActionIcon = getActionIcon(rule.action_type);
              const actionColor = getActionColor(rule.action_type);
              
              return (
                <div
                  key={rule.id}
                  className="p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <ActionIcon className={`w-6 h-6 ${actionColor}`} />
                        <h3 className="text-lg font-semibold text-white">{rule.rule_name}</h3>
                        {rule.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            <Play className="w-3 h-3 inline mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            <Pause className="w-3 h-3 inline mr-1" />
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      {rule.rule_description && (
                        <p className="text-gray-400 mb-3">{rule.rule_description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-2">
                          <span>When moving</span>
                          {rule.from_stage_id ? (
                            <>
                              <span className="text-blue-400">{getStageName(rule.from_stage_id)}</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <span className="text-blue-400">Any Stage</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                          <span className="text-green-400">{getStageName(rule.to_stage_id)}</span>
                        </div>
                      </div>
                      
                      {/* Action Details */}
                      <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
                        {rule.action_type === 'create_activity' && (
                          <div>
                            <strong>Creates Activity:</strong> {rule.activity_title} 
                            {rule.activity_type && ` (${ACTIVITY_TYPES.find(a => a.value === rule.activity_type)?.label})`}
                            {rule.activity_amount_source === 'deal_value' && <span className="ml-2 text-green-400">• Uses deal value</span>}
                            {rule.activity_amount_source === 'fixed_amount' && rule.activity_fixed_amount && 
                              <span className="ml-2 text-green-400">• Fixed amount: ${rule.activity_fixed_amount}</span>}
                          </div>
                        )}
                        
                        {rule.action_type === 'create_task' && (
                          <div>
                            <strong>Creates Task:</strong> {rule.task_title}
                            {rule.task_days_after !== undefined && rule.task_days_after > 0 && 
                              <span className="ml-2 text-yellow-400">• Due in {rule.task_days_after} days</span>}
                            {rule.task_priority && (
                              <span className={`ml-2 px-2 py-1 text-xs rounded-full border ${getPriorityClass(rule.task_priority)}`}>
                                {rule.task_priority}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(rule.id!, rule.is_active)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title={rule.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {rule.is_active ? (
                          <Pause className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Play className="w-4 h-4 text-green-400" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(rule)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id!)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-2">How Pipeline Automation Works</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Rules are triggered when deals move from one pipeline stage to another</li>
                <li>• You can specify a source stage (optional) and target stage (required)</li>
                <li>• Multiple rules can be created for the same stage transition</li>
                <li>• Rules execute in order of their execution_order value</li>
                <li>• Only active rules will run automatically</li>
                <li>• All executions are logged for audit and debugging purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}