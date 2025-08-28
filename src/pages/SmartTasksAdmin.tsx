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
  Calendar,
  AlertCircle,
  Zap,
  ArrowLeft,
  Clock,
  Flag
} from 'lucide-react';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useAuth } from '@/lib/hooks/useAuth';

interface SmartTaskTemplate {
  id?: string;
  trigger_activity_type: string;
  task_title: string;
  task_description: string;
  days_after_trigger: number;
  task_type: string;
  priority: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const ACTIVITY_TYPES = [
  { value: 'proposal', label: 'Proposal Sent', icon: '📄' },
  { value: 'meeting', label: 'Meeting Scheduled', icon: '📅' },
  { value: 'outbound', label: 'Outbound Activity', icon: '📤' },
  { value: 'demo', label: 'Demo Completed', icon: '🖥️' },
  { value: 'signed', label: 'Deal Signed', icon: '✅' },
  { value: 'negotiation', label: 'Negotiation Started', icon: '💬' },
  { value: 'follow_up', label: 'Follow Up', icon: '📞' },
  { value: 'email', label: 'Email Sent', icon: '✉️' },
  { value: 'call', label: 'Call Made', icon: '📱' },
];

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'check_in', label: 'Check In' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'action', label: 'Action Required' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

export default function SmartTasksAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SmartTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState<SmartTaskTemplate>({
    trigger_activity_type: '',
    task_title: '',
    task_description: '',
    days_after_trigger: 3,
    task_type: 'follow_up',
    priority: 'medium',
    is_active: true,
  });

  useEffect(() => {
    checkAdminAccess();
    fetchTemplates();
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

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('smart_task_templates')
        .select('*')
        .order('trigger_activity_type', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load smart task templates');
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

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('smart_task_templates')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('smart_task_templates')
          .insert([{ ...dataToSave, created_by: user?.id }]);

        if (error) throw error;
        toast.success('Template created successfully');
      }

      setEditingId(null);
      setShowNewForm(false);
      resetForm();
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('A template with this trigger and title already exists');
      } else {
        toast.error('Failed to save template');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('smart_task_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('smart_task_templates')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Template ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template status');
    }
  };

  const startEdit = (template: SmartTaskTemplate) => {
    setFormData(template);
    setEditingId(template.id!);
    setShowNewForm(false);
  };

  const resetForm = () => {
    setFormData({
      trigger_activity_type: '',
      task_title: '',
      task_description: '',
      days_after_trigger: 3,
      task_type: 'follow_up',
      priority: 'medium',
      is_active: true,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    resetForm();
  };

  const getPriorityClass = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority)?.color || '';
  };

  const getActivityIcon = (type: string) => {
    return ACTIVITY_TYPES.find(a => a.value === type)?.icon || '📌';
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
                Smart Tasks Administration
              </h1>
              <p className="text-gray-400 mt-2">
                Configure automated follow-up tasks based on activity triggers
              </p>
            </div>
            
            {!showNewForm && !editingId && (
              <button
                onClick={() => setShowNewForm(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            )}
          </div>
        </div>

        {/* New/Edit Form */}
        {(showNewForm || editingId) && (
          <div className="mb-8 p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingId ? 'Edit Template' : 'Create New Template'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trigger Activity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trigger Activity Type
                </label>
                <select
                  value={formData.trigger_activity_type}
                  onChange={(e) => setFormData({ ...formData, trigger_activity_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select trigger...</option>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Task Type
                </label>
                <select
                  value={formData.task_type}
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

              {/* Task Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={formData.task_title}
                  onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                  placeholder="e.g., Follow up on proposal"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Days After Trigger */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Days After Trigger
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.days_after_trigger}
                    onChange={(e) => setFormData({ ...formData, days_after_trigger: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="90"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
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

              {/* Task Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Task Description
                </label>
                <textarea
                  value={formData.task_description}
                  onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                  placeholder="Provide detailed instructions for this task..."
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
                disabled={!formData.trigger_activity_type || !formData.task_title}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No smart task templates configured yet</p>
              <p className="text-sm text-gray-500 mt-2">Create your first template to start automating follow-ups</p>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getActivityIcon(template.trigger_activity_type)}</span>
                      <h3 className="text-lg font-semibold text-white">{template.task_title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityClass(template.priority)}`}>
                        <Flag className="w-3 h-3 inline mr-1" />
                        {template.priority}
                      </span>
                      {template.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          <XCircle className="w-3 h-3 inline mr-1" />
                          Inactive
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-400 mb-3">{template.task_description || 'No description provided'}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Trigger: {ACTIVITY_TYPES.find(a => a.value === template.trigger_activity_type)?.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Create after: {template.days_after_trigger} {template.days_after_trigger === 1 ? 'day' : 'days'}</span>
                      </div>
                      <div>
                        Type: {TASK_TYPES.find(t => t.value === template.task_type)?.label}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(template.id!, template.is_active)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      title={template.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {template.is_active ? (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(template)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id!)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-2">How Smart Tasks Work</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• When an activity matching a trigger type is created, the system automatically generates follow-up tasks</li>
                <li>• Tasks are created with the specified delay (days after trigger)</li>
                <li>• Each task is assigned to the same owner as the triggering activity</li>
                <li>• Tasks are linked to the same deal as the activity for easy tracking</li>
                <li>• Only active templates will generate tasks</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}