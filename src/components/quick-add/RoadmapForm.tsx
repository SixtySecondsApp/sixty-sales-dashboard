import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Map, Zap, AlertTriangle, ArrowRight, Settings, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  { value: 'feature', label: 'Feature', icon: Zap, emoji: '✨' },
  { value: 'bug', label: 'Bug', icon: AlertTriangle, emoji: '🐛' },
  { value: 'improvement', label: 'Improve', icon: ArrowRight, emoji: '📈' },
  { value: 'other', label: 'Other', icon: Settings, emoji: '⚙️' }
];

const priorityOptions = [
  { value: 'low', label: 'Low', emoji: '🟢' },
  { value: 'medium', label: 'Med', emoji: '🟡' },
  { value: 'high', label: 'High', emoji: '🟠' },
  { value: 'critical', label: 'Critical', emoji: '🔴' }
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
  const [showDescription, setShowDescription] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
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
      {/* Compact header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/30">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 hover:bg-gray-800 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <Map className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-gray-300">Roadmap Suggestion</span>
      </div>

      {/* Compact Form */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Title */}
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => handleInputChange('title', e.target.value)}
          placeholder="What would you like to suggest?"
          autoFocus
          className={cn(
            "w-full bg-gray-800/50 border text-white text-sm p-2.5 rounded-lg",
            "placeholder:text-gray-500 transition-all",
            "focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50",
            validationErrors.title ? "border-red-500/50" : "border-gray-700/50"
          )}
        />
        {validationErrors.title && (
          <p className="text-red-400 text-xs -mt-2">{validationErrors.title}</p>
        )}

        {/* Type + Priority side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Type */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Type</label>
            <div className="grid grid-cols-2 gap-1">
              {roadmapTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleInputChange('roadmap_type', type.value)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs transition-all",
                    formData.roadmap_type === type.value
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                      : "bg-gray-800/30 border-gray-700/30 text-gray-500 hover:bg-gray-800/50"
                  )}
                >
                  <span>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
            {validationErrors.roadmap_type && (
              <p className="text-red-400 text-xs mt-1">{validationErrors.roadmap_type}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Priority</label>
            <div className="flex gap-1">
              {priorityOptions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleInputChange('priority', p.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md border text-xs transition-all",
                    formData.priority === p.value
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                      : "bg-gray-800/30 border-gray-700/30 text-gray-500 hover:bg-gray-800/50"
                  )}
                  title={p.label}
                >
                  <span>{p.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Description toggle */}
        <button
          type="button"
          onClick={() => setShowDescription(!showDescription)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors py-1"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", showDescription && "rotate-180")} />
          <span>{showDescription ? 'Hide details' : 'Add details'}</span>
        </button>

        <AnimatePresence>
          {showDescription && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your suggestion in detail..."
                rows={3}
                className={cn(
                  "w-full bg-gray-800/30 border border-gray-700/30 text-white text-xs p-2 rounded-md",
                  "placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none",
                  validationErrors.description && "border-red-500/50"
                )}
              />
              {validationErrors.description && (
                <p className="text-red-400 text-xs mt-1">{validationErrors.description}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compact Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-800/30">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-gray-800/50 border border-gray-700/30 text-gray-400 rounded-lg hover:bg-gray-800 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex-1 py-2 px-4 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all",
            submitStatus === 'success'
              ? "bg-emerald-600 text-white"
              : isSubmitting
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-500"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Submitted!</span>
            </>
          ) : (
            <>
              <Map className="w-3.5 h-3.5" />
              <span>Submit</span>
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}
