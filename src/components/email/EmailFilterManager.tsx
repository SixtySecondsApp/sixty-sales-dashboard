import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Filter,
  Trash2,
  Edit,
  Power,
  Save,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EmailFilter,
  EmailFilterCondition,
  EmailFilterAction,
  FilterCondition,
  FilterAction,
  getAllFilters,
  saveFilter,
  deleteFilter,
  toggleFilterEnabled,
  getFilterStats
} from '@/lib/services/emailFilterService';
import { toast } from 'sonner';

interface EmailFilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const conditionOptions: { value: FilterCondition; label: string }[] = [
  { value: 'from_contains', label: 'From contains' },
  { value: 'from_is', label: 'From is' },
  { value: 'to_contains', label: 'To contains' },
  { value: 'subject_contains', label: 'Subject contains' },
  { value: 'subject_is', label: 'Subject is' },
  { value: 'body_contains', label: 'Body contains' },
  { value: 'has_attachment', label: 'Has attachment' },
  { value: 'is_starred', label: 'Is starred' },
  { value: 'is_read', label: 'Is read' },
  { value: 'is_important', label: 'Is important' },
  { value: 'label_is', label: 'Has label' },
  { value: 'older_than', label: 'Older than (days)' },
  { value: 'newer_than', label: 'Newer than (days)' }
];

const actionOptions: { value: FilterAction; label: string }[] = [
  { value: 'archive', label: 'Archive email' },
  { value: 'delete', label: 'Move to trash' },
  { value: 'star', label: 'Star email' },
  { value: 'mark_read', label: 'Mark as read' },
  { value: 'mark_unread', label: 'Mark as unread' },
  { value: 'mark_important', label: 'Mark as important' },
  { value: 'add_label', label: 'Add label' },
  { value: 'move_to_folder', label: 'Move to folder' }
];

export function EmailFilterManager({ isOpen, onClose }: EmailFilterManagerProps) {
  const [filters, setFilters] = useState<EmailFilter[]>(getAllFilters());
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for creating/editing
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMatchType, setFormMatchType] = useState<'all' | 'any'>('all');
  const [formConditions, setFormConditions] = useState<EmailFilterCondition[]>([]);
  const [formActions, setFormActions] = useState<EmailFilterAction[]>([]);

  const refreshFilters = () => {
    setFilters(getAllFilters());
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingFilter(null);
    setFormName('');
    setFormDescription('');
    setFormMatchType('all');
    setFormConditions([]);
    setFormActions([]);
  };

  const handleEdit = (filter: EmailFilter) => {
    setIsCreating(false);
    setEditingFilter(filter);
    setFormName(filter.name);
    setFormDescription(filter.description || '');
    setFormMatchType(filter.matchType);
    setFormConditions(filter.conditions);
    setFormActions(filter.actions);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    if (formConditions.length === 0) {
      toast.error('Please add at least one condition');
      return;
    }

    if (formActions.length === 0) {
      toast.error('Please add at least one action');
      return;
    }

    try {
      saveFilter({
        id: editingFilter?.id,
        name: formName,
        description: formDescription,
        enabled: true,
        conditions: formConditions,
        actions: formActions,
        matchType: formMatchType
      });

      toast.success(editingFilter ? 'Filter updated' : 'Filter created');
      refreshFilters();
      setIsCreating(false);
      setEditingFilter(null);
    } catch (error) {
      toast.error('Failed to save filter');
    }
  };

  const handleDelete = (filterId: string) => {
    if (!confirm('Delete this filter?')) return;

    if (deleteFilter(filterId)) {
      toast.success('Filter deleted');
      refreshFilters();
    } else {
      toast.error('Failed to delete filter');
    }
  };

  const handleToggle = (filterId: string) => {
    if (toggleFilterEnabled(filterId)) {
      refreshFilters();
      toast.success('Filter updated');
    }
  };

  const addCondition = () => {
    setFormConditions([...formConditions, { field: 'from_contains', value: '' }]);
  };

  const updateCondition = (index: number, field: FilterCondition, value: string | number | boolean) => {
    const newConditions = [...formConditions];
    newConditions[index] = { field, value };
    setFormConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setFormActions([...formActions, { type: 'archive' }]);
  };

  const updateAction = (index: number, type: FilterAction, value?: string) => {
    const newActions = [...formActions];
    newActions[index] = { type, value };
    setFormActions(newActions);
  };

  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const stats = getFilterStats();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Filter className="w-6 h-6 text-[#37bd7e]" />
                  Email Filters & Rules
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {stats.total} filter{stats.total !== 1 ? 's' : ''} • {stats.enabled} enabled • {stats.disabled} disabled
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Info banner */}
            <div className="mt-4 flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium">How filters work</p>
                <p className="text-blue-300 mt-1">
                  Filters automatically organize your emails based on conditions you set. Create rules to archive, label, or star emails as they arrive.
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {(isCreating || editingFilter) ? (
              /* Filter Editor */
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Filter Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Archive newsletters"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  />
                </div>

                {/* Match Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Match Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formMatchType === 'all'}
                        onChange={() => setFormMatchType('all')}
                        className="text-[#37bd7e]"
                      />
                      <span className="text-sm text-gray-300">Match ALL conditions (AND)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formMatchType === 'any'}
                        onChange={() => setFormMatchType('any')}
                        className="text-[#37bd7e]"
                      />
                      <span className="text-sm text-gray-300">Match ANY condition (OR)</span>
                    </label>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-300">
                      Conditions *
                    </label>
                    <button
                      onClick={addCondition}
                      className="px-3 py-1 bg-[#37bd7e]/10 hover:bg-[#37bd7e]/20 text-[#37bd7e] rounded-lg text-sm flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Condition
                    </button>
                  </div>

                  {formConditions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-700 rounded-lg">
                      No conditions added yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formConditions.map((condition, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            value={condition.field}
                            onChange={(e) => updateCondition(index, e.target.value as FilterCondition, condition.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          >
                            {conditionOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          {['has_attachment', 'is_starred', 'is_read', 'is_important'].includes(condition.field) ? (
                            <select
                              value={String(condition.value)}
                              onChange={(e) => updateCondition(index, condition.field, e.target.value === 'true')}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={['older_than', 'newer_than'].includes(condition.field) ? 'number' : 'text'}
                              value={String(condition.value)}
                              onChange={(e) => updateCondition(index, condition.field, e.target.value)}
                              placeholder="Value..."
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                            />
                          )}

                          <button
                            onClick={() => removeCondition(index)}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-300">
                      Actions *
                    </label>
                    <button
                      onClick={addAction}
                      className="px-3 py-1 bg-[#37bd7e]/10 hover:bg-[#37bd7e]/20 text-[#37bd7e] rounded-lg text-sm flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Action
                    </button>
                  </div>

                  {formActions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-700 rounded-lg">
                      No actions added yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formActions.map((action, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            value={action.type}
                            onChange={(e) => updateAction(index, e.target.value as FilterAction, action.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          >
                            {actionOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          {['add_label', 'move_to_folder'].includes(action.type) && (
                            <input
                              type="text"
                              value={action.value || ''}
                              onChange={(e) => updateAction(index, action.type, e.target.value)}
                              placeholder={action.type === 'add_label' ? 'Label name...' : 'Folder name...'}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                            />
                          )}

                          <button
                            onClick={() => removeAction(index)}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingFilter ? 'Update Filter' : 'Create Filter'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsCreating(false);
                      setEditingFilter(null);
                    }}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            ) : (
              /* Filter List */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Your Filters</h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Filter
                  </motion.button>
                </div>

                {filters.length === 0 ? (
                  <div className="text-center py-12">
                    <Filter className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">
                      No filters created yet
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Create your first filter to automatically organize your emails
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filters.map((filter) => (
                      <motion.div
                        key={filter.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-4 rounded-lg border transition-all',
                          filter.enabled
                            ? 'bg-gray-800/50 border-gray-700'
                            : 'bg-gray-800/20 border-gray-800 opacity-60'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-white">{filter.name}</h4>
                              {filter.enabled ? (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                                  Disabled
                                </span>
                              )}
                            </div>

                            {filter.description && (
                              <p className="text-sm text-gray-400 mb-2">{filter.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{filter.conditions.length} condition{filter.conditions.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>{filter.actions.length} action{filter.actions.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>Match {filter.matchType === 'all' ? 'ALL' : 'ANY'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleToggle(filter.id)}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                filter.enabled
                                  ? 'hover:bg-gray-700 text-green-400'
                                  : 'hover:bg-gray-700 text-gray-500'
                              )}
                              title={filter.enabled ? 'Disable' : 'Enable'}
                            >
                              <Power className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEdit(filter)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(filter.id)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
