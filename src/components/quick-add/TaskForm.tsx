import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckSquare, Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartDates } from './hooks/useSmartDates';
import type { QuickAddFormData, TaskType, Priority, ValidationErrors } from './types';

interface TaskFormProps {
  formData: QuickAddFormData;
  setFormData: (data: QuickAddFormData) => void;
  validationErrors: ValidationErrors;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onBack: () => void;
}

// Compact task type options
const taskTypes: TaskType[] = [
  { value: 'call', label: 'Call', icon: '📞', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', iconColor: 'text-blue-500' },
  { value: 'email', label: 'Email', icon: '✉️', color: 'bg-green-500/20 text-green-400 border-green-500/40', iconColor: 'text-green-500' },
  { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40', iconColor: 'text-purple-500' },
  { value: 'follow_up', label: 'Follow Up', icon: '🔄', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', iconColor: 'text-orange-500' },
  { value: 'demo', label: 'Demo', icon: '🎯', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', iconColor: 'text-indigo-500' },
  { value: 'general', label: 'Other', icon: '⚡', color: 'bg-gray-500/20 text-gray-400 border-gray-500/40', iconColor: 'text-gray-400' },
];

// Compact priority options
const priorities: Priority[] = [
  { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/40', ringColor: 'ring-green-500/30' },
  { value: 'medium', label: 'Med', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', ringColor: 'ring-yellow-500/30' },
  { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', ringColor: 'ring-orange-500/30' },
  { value: 'urgent', label: 'Urgent', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/40', ringColor: 'ring-red-500/30' },
];

export function TaskForm({ 
  formData, 
  setFormData, 
  validationErrors, 
  isSubmitting, 
  submitStatus, 
  onSubmit, 
  onBack 
}: TaskFormProps) {
  const { getSmartQuickDates } = useSmartDates();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const quickDates = getSmartQuickDates().slice(0, 4);

  const handleQuickDate = (dateValue: string) => {
    setFormData({ ...formData, due_date: dateValue });
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
      onSubmit={onSubmit}
      className="flex flex-col h-full"
    >
      {/* Ultra-compact header - just back + icon + title inline */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/30">
        <button
          type="button"
          onClick={onBack}
          className="p-1 hover:bg-gray-800 rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <CheckSquare className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-300">New Task</span>
      </div>

      {/* Compact Form Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Task Title */}
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="What needs to be done?"
          autoFocus
          className={cn(
            "w-full bg-gray-800/50 border text-white text-sm p-2.5 rounded-lg",
            "placeholder:text-gray-500 transition-all",
            "focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50",
            validationErrors.title
              ? "border-red-500/50"
              : "border-gray-700/50"
          )}
          required
        />
        {validationErrors.title && (
          <p className="text-red-400 text-xs flex items-center gap-1 -mt-2">
            <AlertCircle className="w-3 h-3" />
            {validationErrors.title}
          </p>
        )}

        {/* Type + Priority side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Task Type */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1">
              {taskTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, task_type: type.value as any })}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-all",
                    formData.task_type === type.value
                      ? type.color
                      : "bg-gray-800/30 border-gray-700/30 text-gray-500 hover:bg-gray-800/50"
                  )}
                >
                  <span className="text-xs">{type.icon}</span>
                  <span className="hidden sm:inline">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Priority</label>
            <div className="flex gap-1">
              {priorities.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: priority.value as any })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md border text-xs transition-all",
                    formData.priority === priority.value
                      ? priority.color
                      : "bg-gray-800/30 border-gray-700/30 text-gray-500 hover:bg-gray-800/50"
                  )}
                  title={priority.label}
                >
                  <span>{priority.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Due Date - compact row */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Due</label>
          <div className="flex gap-1.5 mb-1.5">
            {quickDates.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => handleQuickDate(quick.value)}
                className={cn(
                  "flex-1 flex flex-col items-center py-1.5 rounded-md border text-xs transition-all",
                  formData.due_date === quick.value
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                    : "bg-gray-800/30 border-gray-700/30 text-gray-500 hover:bg-gray-800/50"
                )}
              >
                <span className="text-sm leading-none">{quick.icon}</span>
                <span className="text-[10px] mt-0.5">{quick.label.replace('Tomorrow ', 'Tom ')}</span>
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full bg-gray-800/30 border border-gray-700/30 text-gray-400 text-xs p-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>

        {/* Advanced Options - Collapsed */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors py-1"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
          <span>{showAdvanced ? 'Less options' : 'More options'}</span>
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2 overflow-hidden"
            >
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full bg-gray-800/30 border border-gray-700/30 text-white text-xs p-2 rounded-md placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Contact name"
                  className="bg-gray-800/30 border border-gray-700/30 text-white text-xs p-2 rounded-md placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <input
                  type="text"
                  value={formData.company_website}
                  onChange={(e) => {
                    let website = e.target.value.trim();
                    if (website && !website.startsWith('www.') && !website.startsWith('http')) {
                      if (website.includes('.') && !website.includes(' ')) {
                        website = `www.${website}`;
                      }
                    }
                    setFormData({ ...formData, company_website: website });
                  }}
                  placeholder="Company website"
                  className="bg-gray-800/30 border border-gray-700/30 text-white text-xs p-2 rounded-md placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compact Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-800/30">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-gray-800/50 border border-gray-700/30 text-gray-400 rounded-lg hover:bg-gray-800 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex-1 py-2 px-4 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all",
            submitStatus === 'success'
              ? "bg-emerald-600 text-white"
              : isSubmitting
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-500"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Creating...</span>
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Created!</span>
            </>
          ) : (
            <>
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}
