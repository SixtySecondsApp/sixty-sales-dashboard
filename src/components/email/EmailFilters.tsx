import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Mail,
  Tag,
  Archive,
  Trash2,
  Star,
  Bell,
  Eye,
  EyeOff,
  FolderPlus,
  Zap,
  Settings,
  Save,
  Trash,
  Edit2,
  Copy,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmailFilter {
  id: string;
  name: string;
  enabled: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FilterCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has-attachment' | 'label' | 'size';
  operator: 'contains' | 'not-contains' | 'equals' | 'starts-with' | 'ends-with' | 'greater-than' | 'less-than';
  value: string;
  matchType?: 'any' | 'all';
}

interface FilterAction {
  type: 'apply-label' | 'remove-label' | 'mark-read' | 'mark-important' | 'star' | 'archive' | 'delete' | 'forward' | 'categorize';
  value?: string;
}

const defaultFilters: EmailFilter[] = [
  {
    id: '1',
    name: 'Important Clients',
    enabled: true,
    conditions: [
      { field: 'from', operator: 'contains', value: '@important-client.com' }
    ],
    actions: [
      { type: 'mark-important' },
      { type: 'apply-label', value: 'VIP' }
    ],
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Newsletter Cleanup',
    enabled: true,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'newsletter' },
      { field: 'from', operator: 'contains', value: 'noreply' }
    ],
    actions: [
      { type: 'apply-label', value: 'Newsletters' },
      { type: 'mark-read' },
      { type: 'archive' }
    ],
    priority: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Large Attachments',
    enabled: false,
    conditions: [
      { field: 'has-attachment', operator: 'equals', value: 'true' },
      { field: 'size', operator: 'greater-than', value: '10MB' }
    ],
    actions: [
      { type: 'apply-label', value: 'Large Files' },
      { type: 'star' }
    ],
    priority: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

interface EmailFiltersProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailFilters({ isOpen, onClose }: EmailFiltersProps) {
  const [filters, setFilters] = useState<EmailFilter[]>(defaultFilters);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state for new/edit filter
  const [filterName, setFilterName] = useState('');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: 'from', operator: 'contains', value: '' }
  ]);
  const [actions, setActions] = useState<FilterAction[]>([
    { type: 'apply-label', value: '' }
  ]);

  const handleSaveFilter = () => {
    if (!filterName) {
      toast.error('Please enter a filter name');
      return;
    }

    if (conditions.some(c => !c.value)) {
      toast.error('Please fill in all condition values');
      return;
    }

    const newFilter: EmailFilter = {
      id: editingFilter?.id || Date.now().toString(),
      name: filterName,
      enabled: true,
      conditions,
      actions,
      priority: editingFilter?.priority || filters.length + 1,
      createdAt: editingFilter?.createdAt || new Date(),
      updatedAt: new Date()
    };

    if (editingFilter) {
      setFilters(filters.map(f => f.id === editingFilter.id ? newFilter : f));
      toast.success('Filter updated successfully');
    } else {
      setFilters([...filters, newFilter]);
      toast.success('Filter created successfully');
    }

    resetForm();
  };

  const handleDeleteFilter = (id: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) return;
    setFilters(filters.filter(f => f.id !== id));
    toast.success('Filter deleted');
  };

  const handleToggleFilter = (id: string) => {
    setFilters(filters.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const handleEditFilter = (filter: EmailFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setConditions(filter.conditions);
    setActions(filter.actions);
    setIsCreating(true);
  };

  const handleDuplicateFilter = (filter: EmailFilter) => {
    const newFilter: EmailFilter = {
      ...filter,
      id: Date.now().toString(),
      name: `${filter.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setFilters([...filters, newFilter]);
    toast.success('Filter duplicated');
  };

  const resetForm = () => {
    setFilterName('');
    setConditions([{ field: 'from', operator: 'contains', value: '' }]);
    setActions([{ type: 'apply-label', value: '' }]);
    setEditingFilter(null);
    setIsCreating(false);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'from', operator: 'contains', value: '' }]);
  };

  const updateCondition = (index: number, condition: FilterCondition) => {
    const updated = [...conditions];
    updated[index] = condition;
    setConditions(updated);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const addAction = () => {
    setActions([...actions, { type: 'apply-label', value: '' }]);
  };

  const updateAction = (index: number, action: FilterAction) => {
    const updated = [...actions];
    updated[index] = action;
    setActions(updated);
  };

  const removeAction = (index: number) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const getActionIcon = (type: FilterAction['type']) => {
    switch (type) {
      case 'apply-label': return <Tag className="w-3 h-3" />;
      case 'mark-read': return <Eye className="w-3 h-3" />;
      case 'mark-important': return <Bell className="w-3 h-3" />;
      case 'star': return <Star className="w-3 h-3" />;
      case 'archive': return <Archive className="w-3 h-3" />;
      case 'delete': return <Trash2 className="w-3 h-3" />;
      case 'forward': return <Mail className="w-3 h-3" />;
      case 'categorize': return <FolderPlus className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#37bd7e]" />
                Email Filters & Rules
              </h2>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-1.5 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Filter
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isCreating ? (
                // Create/Edit Form
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Filter Name</label>
                    <input
                      type="text"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      placeholder="Enter filter name"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                    />
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-400">Conditions</label>
                      <span className="text-xs text-gray-500">Match all conditions</span>
                    </div>
                    <div className="space-y-2">
                      {conditions.map((condition, idx) => (
                        <div key={idx} className="flex gap-2">
                          <select
                            value={condition.field}
                            onChange={(e) => updateCondition(idx, {
                              ...condition,
                              field: e.target.value as FilterCondition['field']
                            })}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          >
                            <option value="from">From</option>
                            <option value="to">To</option>
                            <option value="subject">Subject</option>
                            <option value="body">Body</option>
                            <option value="has-attachment">Has Attachment</option>
                            <option value="label">Label</option>
                            <option value="size">Size</option>
                          </select>
                          <select
                            value={condition.operator}
                            onChange={(e) => updateCondition(idx, {
                              ...condition,
                              operator: e.target.value as FilterCondition['operator']
                            })}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          >
                            <option value="contains">Contains</option>
                            <option value="not-contains">Doesn't contain</option>
                            <option value="equals">Equals</option>
                            <option value="starts-with">Starts with</option>
                            <option value="ends-with">Ends with</option>
                            {(condition.field === 'size') && (
                              <>
                                <option value="greater-than">Greater than</option>
                                <option value="less-than">Less than</option>
                              </>
                            )}
                          </select>
                          <input
                            type="text"
                            value={condition.value}
                            onChange={(e) => updateCondition(idx, {
                              ...condition,
                              value: e.target.value
                            })}
                            placeholder="Value"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          />
                          <button
                            onClick={() => removeCondition(idx)}
                            className="p-1 text-gray-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addCondition}
                        className="text-sm text-[#37bd7e] hover:text-[#2da76c] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add condition
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Actions</label>
                    <div className="space-y-2">
                      {actions.map((action, idx) => (
                        <div key={idx} className="flex gap-2">
                          <select
                            value={action.type}
                            onChange={(e) => updateAction(idx, {
                              ...action,
                              type: e.target.value as FilterAction['type']
                            })}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                          >
                            <option value="apply-label">Apply label</option>
                            <option value="remove-label">Remove label</option>
                            <option value="mark-read">Mark as read</option>
                            <option value="mark-important">Mark as important</option>
                            <option value="star">Add star</option>
                            <option value="archive">Archive</option>
                            <option value="delete">Delete</option>
                            <option value="forward">Forward to</option>
                            <option value="categorize">Categorize as</option>
                          </select>
                          {(action.type === 'apply-label' || action.type === 'remove-label' || 
                            action.type === 'forward' || action.type === 'categorize') && (
                            <input
                              type="text"
                              value={action.value || ''}
                              onChange={(e) => updateAction(idx, {
                                ...action,
                                value: e.target.value
                              })}
                              placeholder={
                                action.type === 'forward' ? 'Email address' :
                                action.type === 'categorize' ? 'Category' : 'Label name'
                              }
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                            />
                          )}
                          <button
                            onClick={() => removeAction(idx)}
                            className="p-1 text-gray-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addAction}
                        className="text-sm text-[#37bd7e] hover:text-[#2da76c] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add action
                      </button>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveFilter}
                      className="px-4 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingFilter ? 'Update' : 'Create'} Filter
                    </button>
                  </div>
                </div>
              ) : (
                // Filters List
                <div className="space-y-2">
                  {filters.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No filters created yet</p>
                      <p className="text-sm mt-1">Create your first filter to automate email management</p>
                    </div>
                  ) : (
                    filters.map((filter) => (
                      <motion.div
                        key={filter.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setExpandedFilter(
                                  expandedFilter === filter.id ? null : filter.id
                                )}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                              >
                                {expandedFilter === filter.id ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={filter.enabled}
                                  onChange={() => handleToggleFilter(filter.id)}
                                  className="rounded border-gray-600 text-[#37bd7e] focus:ring-[#37bd7e]"
                                />
                                <span className="font-medium">{filter.name}</span>
                              </label>
                              {filter.enabled ? (
                                <span className="px-2 py-0.5 bg-[#37bd7e]/20 text-[#37bd7e] text-xs rounded">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditFilter(filter)}
                                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicateFilter(filter)}
                                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFilter(filter.id)}
                                className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Summary */}
                          <div className="mt-2 ml-10 flex items-center gap-4 text-xs text-gray-400">
                            <span>{filter.conditions.length} condition{filter.conditions.length !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span>{filter.actions.length} action{filter.actions.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedFilter === filter.id && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-gray-700">
                            {/* Conditions */}
                            <div className="mt-3">
                              <div className="text-xs font-medium text-gray-400 mb-2">When:</div>
                              <div className="space-y-1">
                                {filter.conditions.map((condition, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    {idx > 0 && <span className="text-gray-500">AND</span>}
                                    <span className="text-gray-300">
                                      {condition.field} {condition.operator.replace('-', ' ')} "{condition.value}"
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div>
                              <div className="text-xs font-medium text-gray-400 mb-2">Then:</div>
                              <div className="space-y-1">
                                {filter.actions.map((action, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    {getActionIcon(action.type)}
                                    <span className="text-gray-300">
                                      {action.type.replace('-', ' ')}
                                      {action.value && `: "${action.value}"`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Info Footer */}
            {!isCreating && filters.length > 0 && (
              <div className="p-4 border-t border-gray-800 bg-gray-800/30">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Filters are applied in order of priority. Active filters run automatically on new emails.</span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}