/**
 * NextActionPanel Component
 *
 * Slide-in panel displaying all suggestions for an activity
 * with bulk actions and filtering options
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useNextActions } from '@/lib/hooks/useNextActions'
import { NextActionCard } from './NextActionCard'
import { CreateTaskFromSuggestionModal } from './CreateTaskFromSuggestionModal'
import { NextActionSuggestion } from '@/lib/services/nextActionsService'

interface NextActionPanelProps {
  activityId?: string
  activityType?: 'meeting' | 'activity' | 'email' | 'proposal' | 'call'
  dealId?: string
  companyId?: string
  contactId?: string
  isOpen: boolean
  onClose: () => void
}

export const NextActionPanel: React.FC<NextActionPanelProps> = ({
  activityId,
  activityType,
  dealId,
  companyId,
  contactId,
  isOpen,
  onClose,
}) => {
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [editingSuggestion, setEditingSuggestion] = useState<NextActionSuggestion | null>(null)

  const {
    suggestions,
    isLoading,
    pendingCount,
    groupedByUrgency,
    acceptSuggestion,
    dismissSuggestion,
    acceptAll,
    dismissAll,
    regenerate,
  } = useNextActions({
    activityId,
    activityType,
    dealId,
    companyId,
    contactId,
    status: 'pending',
    enableRealtime: true,
  })

  const filteredSuggestions =
    filterUrgency === 'all'
      ? suggestions
      : suggestions.filter((s) => s.urgency === filterUrgency)

  const handleAcceptAll = async () => {
    try {
      await acceptAll()
      onClose()
    } catch (error) {
      console.error('Failed to accept all suggestions:', error)
    }
  }

  const handleDismissAll = async () => {
    try {
      await dismissAll('Dismissed all via panel')
      onClose()
    } catch (error) {
      console.error('Failed to dismiss all suggestions:', error)
    }
  }

  const handleRegenerate = async () => {
    try {
      await regenerate()
    } catch (error) {
      console.error('Failed to regenerate suggestions:', error)
    }
  }

  const handleAcceptSuggestion = async (suggestionId: string) => {
    try {
      await acceptSuggestion(suggestionId)
    } catch (error) {
      console.error('Failed to accept suggestion:', error)
    }
  }

  const handleDismissSuggestion = async (suggestionId: string) => {
    try {
      await dismissSuggestion(suggestionId, 'Dismissed from panel')
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    }
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      AI Suggestions
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {pendingCount} pending {pendingCount === 1 ? 'action' : 'actions'}
                    </p>
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

              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                {/* Filter */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    <span>
                      {filterUrgency === 'all'
                        ? 'All'
                        : filterUrgency.charAt(0).toUpperCase() + filterUrgency.slice(1)}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>

                  {showFilterMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      {['all', 'high', 'medium', 'low'].map((urgency) => (
                        <button
                          key={urgency}
                          onClick={() => {
                            setFilterUrgency(urgency as any)
                            setShowFilterMenu(false)
                          }}
                          className={cn(
                            'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 first:rounded-t-lg last:rounded-b-lg',
                            filterUrgency === urgency &&
                              'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {urgency === 'all' ? (
                            <span>All Priorities</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              {urgency === 'high' && <AlertCircle className="w-4 h-4 text-red-400" />}
                              {urgency === 'medium' && <Zap className="w-4 h-4 text-emerald-400" />}
                              {urgency === 'low' && <Sparkles className="w-4 h-4 text-blue-400" />}
                              {urgency.charAt(0).toUpperCase() + urgency.slice(1)} Priority
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Urgency Counts */}
                <div className="flex items-center gap-2">
                  {groupedByUrgency.high.length > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {groupedByUrgency.high.length}
                    </Badge>
                  )}
                  {groupedByUrgency.medium.length > 0 && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      <Zap className="w-3 h-3 mr-1" />
                      {groupedByUrgency.medium.length}
                    </Badge>
                  )}
                  {groupedByUrgency.low.length > 0 && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {groupedByUrgency.low.length}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isLoading}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading && filteredSuggestions.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">Analyzing activity...</p>
                    </div>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        No suggestions yet
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        AI suggestions will appear here after activity analysis
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isLoading}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Generate Suggestions
                      </Button>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredSuggestions.map((suggestion) => (
                      <NextActionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={() => handleAcceptSuggestion(suggestion.id)}
                        onDismiss={() => handleDismissSuggestion(suggestion.id)}
                        onEditAndAccept={() => setEditingSuggestion(suggestion)}
                        showCompanyInfo={true}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              {filteredSuggestions.length > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="default"
                      onClick={handleAcceptAll}
                      disabled={isLoading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Accept All ({filteredSuggestions.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDismissAll}
                      disabled={isLoading}
                      className="flex-1 border-gray-300 dark:border-gray-600"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Dismiss All
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      {editingSuggestion && (
        <CreateTaskFromSuggestionModal
          suggestion={editingSuggestion}
          isOpen={!!editingSuggestion}
          onClose={() => setEditingSuggestion(null)}
          onSuccess={() => {
            setEditingSuggestion(null)
          }}
        />
      )}
    </>
  )
}

export default NextActionPanel
