import { motion } from 'framer-motion';
import { ArrowRight, CheckSquare, Target, Zap, Flag, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

// Task type options with icons and colors
const taskTypes: TaskType[] = [
  { value: 'call', label: 'Phone Call', icon: '📞', color: 'bg-blue-500/20 text-blue-400', iconColor: 'text-blue-500' },
  { value: 'email', label: 'Email', icon: '✉️', color: 'bg-green-500/20 text-green-400', iconColor: 'text-green-500' },
  { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-purple-500/20 text-purple-400', iconColor: 'text-purple-500' },
  { value: 'follow_up', label: 'Follow Up', icon: '🔄', color: 'bg-orange-500/20 text-orange-400', iconColor: 'text-orange-500' },
  { value: 'demo', label: 'Demo', icon: '🎯', color: 'bg-indigo-500/20 text-indigo-400', iconColor: 'text-indigo-500' },
  { value: 'proposal', label: 'Proposal', icon: '📋', color: 'bg-yellow-500/20 text-yellow-400', iconColor: 'text-yellow-500' },
  { value: 'general', label: 'General', icon: '⚡', color: 'bg-gray-500/20 text-gray-400', iconColor: 'text-gray-400' },
];

// Priority options with visual indicators
const priorities: Priority[] = [
  { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', ringColor: 'ring-green-500/30' },
  { value: 'medium', label: 'Medium', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', ringColor: 'ring-yellow-500/30' },
  { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', ringColor: 'ring-orange-500/30' },
  { value: 'urgent', label: 'Urgent', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', ringColor: 'ring-red-500/30' },
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

  const handleQuickDate = (dateValue: string) => {
    setFormData({ ...formData, due_date: dateValue });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={onSubmit}
      className="space-y-6"
    >
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="p-2 hover:bg-gray-800/50 rounded-xl transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-gray-400 rotate-180" />
        </button>
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-500" />
            Create New Task
          </h3>
          <p className="text-gray-400 text-sm">Set up your task quickly and efficiently</p>
        </div>
      </div>

      {/* Task Title */}
      <div className="space-y-3">
        <label className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          What needs to be done? *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Call John about the proposal"
          className={cn(
            "w-full bg-gray-800/50 border text-white text-lg p-4 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all",
            validationErrors.title 
              ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" 
              : "border-gray-600/50"
          )}
          required
        />
        {validationErrors.title && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {validationErrors.title}
          </p>
        )}
      </div>

      {/* Task Type & Priority Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Task Type */}
        <div className="space-y-3">
          <label className="text-base font-medium text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Task Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {taskTypes.slice(0, 4).map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, task_type: type.value as any })}
                className={`p-3 rounded-xl border transition-all ${
                  formData.task_type === type.value
                    ? `${type.color} border-current`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {taskTypes.slice(4).map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, task_type: type.value as any })}
                className={`p-3 rounded-xl border transition-all ${
                  formData.task_type === type.value
                    ? `${type.color} border-current`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-3">
          <label className="text-base font-medium text-white flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            Priority Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            {priorities.map((priority) => (
              <button
                key={priority.value}
                type="button"
                onClick={() => setFormData({ ...formData, priority: priority.value as any })}
                className={`p-3 rounded-xl border transition-all ${
                  formData.priority === priority.value
                    ? `${priority.color} ${priority.ringColor} ring-2`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{priority.icon}</span>
                  <span className="text-xs font-medium">{priority.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Due Date Section */}
      <div className="space-y-4">
        <label className="text-base font-medium text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-green-400" />
          When is this due?
        </label>
        
        {/* Smart Quick Date Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {getSmartQuickDates().map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => handleQuickDate(quick.value)}
              className={`p-3 rounded-xl border transition-all group ${
                formData.due_date === quick.value
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                  : 'bg-gray-800/30 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{quick.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-medium">{quick.label}</div>
                  <div className="text-xs opacity-70">{quick.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {/* Custom Date Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Or set a custom date & time</label>
          <input
            type="datetime-local"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-3">
        <label className="text-base font-medium text-white">
          Additional Details (Optional)
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Any additional context or notes..."
          rows={3}
          className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all resize-none"
        />
      </div>

      {/* Contact & Company Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Contact Name</label>
          <input
            type="text"
            value={formData.contact_name}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            placeholder="John Smith"
            className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Company Website</label>
          <input
            type="text"
            value={formData.company_website}
            onChange={(e) => {
              let website = e.target.value.trim();
              
              // Auto-add www. if user enters a domain without it
              if (website && !website.startsWith('www.') && !website.startsWith('http')) {
                // Check if it looks like a domain (has a dot and no spaces)
                if (website.includes('.') && !website.includes(' ')) {
                  website = `www.${website}`;
                }
              }
              
              setFormData({ ...formData, company_website: website });
            }}
            placeholder="www.company.com"
            className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 bg-gray-800/50 border border-gray-600/50 text-gray-300 rounded-xl hover:bg-gray-700/50 transition-all font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex-1 py-3 px-4 text-white rounded-xl transition-all font-medium shadow-lg flex items-center justify-center gap-2",
            submitStatus === 'success' 
              ? "bg-green-600 hover:bg-green-700 shadow-green-500/25"
              : isSubmitting
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/25"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Created!
            </>
          ) : (
            <>
              <CheckSquare className="w-5 h-5" />
              Create Task
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}