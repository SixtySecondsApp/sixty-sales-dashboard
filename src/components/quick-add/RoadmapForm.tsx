import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Map, Flag, Zap, AlertTriangle, Settings, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { QuickAddFormData } from './types';

interface RoadmapFormProps {
  formData: QuickAddFormData;
  setFormData: (data: QuickAddFormData) => void;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  onSubmit: (e: React.FormEvent) => void;
  onBack?: () => void;
}

const roadmapTypes = [
  { value: 'feature', label: 'Feature Request', icon: Zap, color: 'blue' },
  { value: 'bug', label: 'Bug Report', icon: AlertTriangle, color: 'red' },
  { value: 'improvement', label: 'Enhancement', icon: ArrowRight, color: 'green' },
  { value: 'other', label: 'Other', icon: Settings, color: 'gray' }
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'critical', label: 'Critical', color: 'red' }
];

export function RoadmapForm({
  formData,
  setFormData,
  validationErrors,
  isSubmitting,
  submitStatus,
  onSubmit,
  onBack
}: RoadmapFormProps) {
  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/30">
          <Map className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold theme-text-primary">Add Roadmap Suggestion</h3>
          <p className="text-sm theme-text-tertiary">Submit feature requests, bug reports, and improvements</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium theme-text-secondary">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Brief description of your request..."
            className={`w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all ${
              validationErrors.title ? 'border-red-500/50' : ''
            }`}
          />
          {validationErrors.title && (
            <p className="text-sm text-red-400">{validationErrors.title}</p>
          )}
        </div>

        {/* Type Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium theme-text-secondary">
            Request Type <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {roadmapTypes.map((type) => {
              const isSelected = formData.roadmap_type === type.value;
              const IconComponent = type.icon;

              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleInputChange('roadmap_type', type.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                      : 'theme-border theme-bg-elevated hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    isSelected
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700/50 theme-text-tertiary'
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className={`text-sm font-medium ${
                    isSelected ? 'text-blue-600 dark:text-white' : 'theme-text-primary'
                  }`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
          {validationErrors.roadmap_type && (
            <p className="text-sm text-red-400">{validationErrors.roadmap_type}</p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-sm font-medium theme-text-secondary">Priority</label>
          <select
            value={formData.priority || 'medium'}
            onChange={(e) => handleInputChange('priority', e.target.value)}
            className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium theme-text-secondary">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Provide detailed information about your request..."
            rows={4}
            className={`w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none transition-all ${
              validationErrors.description ? 'border-red-500/50' : ''
            }`}
          />
          {validationErrors.description && (
            <p className="text-sm text-red-400">{validationErrors.description}</p>
          )}
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
          className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium transition-all shadow-sm ${
            submitStatus === 'success'
              ? 'bg-emerald-600 dark:bg-emerald-500/10 text-white dark:text-emerald-400 dark:border dark:border-emerald-500/20'
              : submitStatus === 'error'
                ? 'bg-red-600 dark:bg-red-500/10 text-white dark:text-red-400 dark:border dark:border-red-500/20'
                : isSubmitting
                  ? 'bg-blue-500/50 dark:bg-blue-700/50 text-white/70 cursor-not-allowed'
                  : 'bg-blue-600 dark:bg-blue-500/10 text-white dark:text-blue-400 dark:border dark:border-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500/20'
          }`}
        >
          {submitStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : submitStatus === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ArrowRight className="w-5 h-5" />
              Submit Suggestion
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}