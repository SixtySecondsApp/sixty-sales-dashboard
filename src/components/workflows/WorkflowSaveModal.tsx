import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Sparkles, AlertCircle } from 'lucide-react';

interface WorkflowSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  suggestedName?: string;
  suggestedDescription?: string;
  isFirstSave: boolean;
}

export default function WorkflowSaveModal({
  isOpen,
  onClose,
  onSave,
  suggestedName = '',
  suggestedDescription = '',
  isFirstSave
}: WorkflowSaveModalProps) {
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState(suggestedDescription);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (suggestedName) setName(suggestedName);
    if (suggestedDescription) setDescription(suggestedDescription);
  }, [suggestedName, suggestedDescription]);

  const handleSave = () => {
    const newErrors: typeof errors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Workflow name is required';
    }
    
    if (!description.trim()) {
      newErrors.description = 'Please add a description to help you remember what this workflow does';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSave(name.trim(), description.trim());
  };

  const handleGenerateSuggestions = () => {
    setIsGenerating(true);
    // This will be called from parent with actual workflow data
    setTimeout(() => {
      setIsGenerating(false);
    }, 1000);
  };

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full border border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isFirstSave ? 'Save Your Workflow' : 'Update Workflow Details'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Give your workflow a memorable name and description
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* AI Suggestion Banner */}
            {isFirstSave && suggestedName && suggestedDescription && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-700/30 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-300">AI Suggestions Applied</p>
                    <p className="text-xs text-gray-400 mt-1">
                      We've suggested a name and description based on your workflow configuration. Feel free to customize them!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Workflow Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Workflow Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors({ ...errors, name: undefined });
                  }
                }}
                placeholder="e.g., Lead Follow-up Automation"
                className={`w-full px-4 py-2.5 bg-gray-800 border ${
                  errors.name ? 'border-red-500' : 'border-gray-700'
                } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  errors.name ? 'focus:ring-red-500' : 'focus:ring-[#37bd7e]'
                } focus:border-transparent transition-all`}
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors({ ...errors, description: undefined });
                  }
                }}
                placeholder="Describe what this workflow does and when it triggers..."
                rows={4}
                className={`w-full px-4 py-2.5 bg-gray-800 border ${
                  errors.description ? 'border-red-500' : 'border-gray-700'
                } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  errors.description ? 'focus:ring-red-500' : 'focus:ring-[#37bd7e]'
                } focus:border-transparent transition-all resize-none`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.description}
                </p>
              )}
            </div>

            {/* Character counts */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{name.length}/100 characters</span>
              <span>{description.length}/500 characters</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <div className="text-xs text-gray-500">
              {isFirstSave && (
                <span>💡 Tip: A good description helps you remember the workflow's purpose</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isFirstSave ? 'Save Workflow' : 'Update'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}