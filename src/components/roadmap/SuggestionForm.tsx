import React, { useState, useEffect } from 'react';
import { Plus, Lightbulb, Bug, ArrowUp, AlertTriangle, Settings, HelpCircle, Trash2, X } from 'lucide-react';
import { RoadmapSuggestion } from '@/lib/hooks/useRoadmap';
import { useUser } from '@/lib/hooks/useUser';

interface SuggestionFormProps {
  suggestion?: RoadmapSuggestion | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string) => Promise<void>;
  initialStatusId?: string | null;
}

export function SuggestionForm({ suggestion, onSave, onCancel, onDelete, initialStatusId }: SuggestionFormProps) {
  const { userData } = useUser();
  const isAdmin = userData?.is_admin || false;
  
  // Validate suggestion prop - if it has no ID or empty ID, treat as new suggestion
  const validSuggestion = suggestion && suggestion.id && suggestion.id.trim() !== '' ? suggestion : null;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature' as RoadmapSuggestion['type'],
    priority: 'medium' as RoadmapSuggestion['priority'],
    status: 'submitted' as RoadmapSuggestion['status'],
    estimated_effort: undefined as RoadmapSuggestion['estimated_effort'],
    target_version: '',
    admin_notes: '',
    assigned_to: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (validSuggestion) {
      setFormData({
        title: validSuggestion.title || '',
        description: validSuggestion.description || '',
        type: validSuggestion.type || 'feature',
        priority: validSuggestion.priority || 'medium',
        status: validSuggestion.status || 'submitted',
        estimated_effort: validSuggestion.estimated_effort,
        target_version: validSuggestion.target_version || '',
        admin_notes: validSuggestion.admin_notes || '',
        assigned_to: validSuggestion.assigned_to || '',
      });
    } else if (initialStatusId) {
      setFormData(prev => ({ ...prev, status: initialStatusId as any }));
    }
  }, [validSuggestion, initialStatusId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Only include fields that the user can update
      const dataToSave: any = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
      };
      
      // Only include status for new suggestions or if admin
      if (isAdmin) {
        Object.assign(dataToSave, formData);
      } else if (!validSuggestion && initialStatusId) {
        dataToSave.status = initialStatusId;
      }
      
      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving suggestion:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!validSuggestion || !onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this suggestion?')) {
      try {
        setIsSubmitting(true);
        await onDelete(validSuggestion.id);
      } catch (error) {
        console.error('Error deleting suggestion:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getTypeIcon = (type: RoadmapSuggestion['type']) => {
    switch (type) {
      case 'feature':
        return <Lightbulb className="w-4 h-4" />;
      case 'bug':
        return <Bug className="w-4 h-4" />;
      case 'improvement':
        return <Settings className="w-4 h-4" />;
      case 'other':
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: RoadmapSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">
          {validSuggestion ? 'Edit Suggestion' : 'Submit a Feature Request or Bug Report'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief, descriptive title for your suggestion"
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Type <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['feature', 'bug', 'improvement', 'other'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type }))}
                    className={`p-3 rounded-lg border transition-all flex items-center gap-2 ${
                      formData.type === type
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span className="text-sm font-medium capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority }))}
                    className={`p-2 rounded-lg border transition-all text-sm font-medium capitalize ${
                      formData.priority === priority
                        ? getPriorityColor(priority)
                        : 'border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Provide detailed information about your suggestion. For bugs, include steps to reproduce. For features, explain the use case and expected behavior."
              rows={6}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Guidelines */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Guidelines for Good Suggestions</h4>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• Be specific and detailed in your description</li>
              <li>• For bugs: Include steps to reproduce and expected vs actual behavior</li>
              <li>• For features: Explain the business value and use cases</li>
              <li>• Search existing suggestions to avoid duplicates</li>
              <li>• Use descriptive titles that summarize the request</li>
            </ul>
          </div>

          {/* Admin-only fields */}
          {isAdmin && validSuggestion && (
            <div className="space-y-4 border-t border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-300">Admin Controls</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="testing">Testing</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Estimated Effort</label>
                  <select
                    value={formData.estimated_effort || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_effort: e.target.value as any || undefined }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Not set</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="extra_large">Extra Large</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Target Version</label>
                <input
                  type="text"
                  value={formData.target_version}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_version: e.target.value }))}
                  placeholder="e.g., 2.0.0"
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Admin Notes</label>
                <textarea
                  value={formData.admin_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, admin_notes: e.target.value }))}
                  placeholder="Internal notes about this suggestion..."
                  rows={3}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <div>
              {validSuggestion && onDelete && isAdmin && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : (validSuggestion ? 'Update Suggestion' : 'Submit Suggestion')}
              </button>
            </div>
          </div>
        </form>
      </div>
  );
}