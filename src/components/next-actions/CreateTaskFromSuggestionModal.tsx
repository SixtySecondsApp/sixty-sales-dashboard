/**
 * CreateTaskFromSuggestionModal Component
 *
 * Modal for creating a task from an AI suggestion with customization options
 * Allows users to edit suggestion details before creating the task
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Calendar, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NextActionSuggestion, CreateTaskOptions } from '@/lib/services/nextActionsService'
import { useNextActions } from '@/lib/hooks/useNextActions'
import { format } from 'date-fns'

interface CreateTaskFromSuggestionModalProps {
  suggestion: NextActionSuggestion
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CreateTaskFromSuggestionModal: React.FC<CreateTaskFromSuggestionModalProps> = ({
  suggestion,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { acceptSuggestion } = useNextActions({})

  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<CreateTaskOptions>({
    title: suggestion.title,
    description: `AI Suggestion: ${suggestion.reasoning}`,
    due_date: suggestion.recommended_deadline || undefined,
    priority: suggestion.urgency as any,
  })

  // Reset form when suggestion changes
  useEffect(() => {
    setFormData({
      title: suggestion.title,
      description: `AI Suggestion: ${suggestion.reasoning}`,
      due_date: suggestion.recommended_deadline || undefined,
      priority: suggestion.urgency as any,
    })
  }, [suggestion])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsCreating(true)
    try {
      await acceptSuggestion(suggestion.id, formData)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const confidencePercentage = Math.round(suggestion.confidence_score * 100)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700/50">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Create Task from AI Suggestion
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          suggestion.urgency === 'high' &&
                            'bg-red-500/10 text-red-400 border-red-500/30',
                          suggestion.urgency === 'medium' &&
                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                          suggestion.urgency === 'low' &&
                            'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        )}
                      >
                        {suggestion.urgency.charAt(0).toUpperCase() + suggestion.urgency.slice(1)}{' '}
                        Priority
                      </Badge>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {confidencePercentage}% confidence
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* AI Reasoning */}
              <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/50">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                  AI Reasoning
                </Label>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {suggestion.reasoning}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-semibold">
                    Task Title *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                    className="bg-white dark:bg-gray-800/50"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add task description"
                    rows={4}
                    className="bg-white dark:bg-gray-800/50 resize-none"
                  />
                </div>

                {/* Due Date & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label htmlFor="due_date" className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Due Date
                    </Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={
                        formData.due_date
                          ? format(new Date(formData.due_date), "yyyy-MM-dd'T'HH:mm")
                          : ''
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                      className="bg-white dark:bg-gray-800/50"
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Priority
                    </Label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Company & Deal Info */}
                {(suggestion.companies || suggestion.deals) && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Related To
                    </Label>
                    {suggestion.companies && (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Company: <span className="font-semibold">{suggestion.companies.name}</span>
                      </div>
                    )}
                    {suggestion.deals && (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Deal:{' '}
                        <span className="font-semibold">
                          {suggestion.deals.title} ({suggestion.deals.stage})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </form>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={isCreating || !formData.title}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isCreating ? 'Creating Task...' : 'Create Task'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default CreateTaskFromSuggestionModal
