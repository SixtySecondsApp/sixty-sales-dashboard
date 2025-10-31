/**
 * NextActionCard Component
 *
 * Individual suggestion card showing AI-recommended next action
 * with reasoning, urgency, quick actions, and user interaction buttons
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  X,
  Edit,
  Clock,
  Zap,
  AlertCircle,
  Sparkles,
  Calendar,
  Building2,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NextActionSuggestion } from '@/lib/services/nextActionsService'
import { format, formatDistanceToNow } from 'date-fns'

interface NextActionCardProps {
  suggestion: NextActionSuggestion
  onAccept: () => Promise<void>
  onDismiss: () => Promise<void>
  onEditAndAccept: () => void
  showCompanyInfo?: boolean
  compact?: boolean
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onEditAndAccept,
  showCompanyInfo = true,
  compact = false,
}) => {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await onAccept()
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      await onDismiss()
    } finally {
      setIsDismissing(false)
    }
  }

  const urgencyConfig = {
    high: {
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'High Priority',
    },
    medium: {
      icon: Zap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      label: 'Medium Priority',
    },
    low: {
      icon: Sparkles,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      label: 'Low Priority',
    },
  }

  const config = urgencyConfig[suggestion.urgency]
  const UrgencyIcon = config.icon

  const confidencePercentage = Math.round(suggestion.confidence_score * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ scale: compact ? 1 : 1.01 }}
      className={cn(
        'bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border transition-all duration-200',
        'border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50',
        'shadow-sm dark:shadow-none group',
        compact && 'p-3'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1">
          <div className={cn('p-2 rounded-lg', config.bgColor, config.borderColor, 'border')}>
            <UrgencyIcon className={cn('w-4 h-4', config.color)} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">
              {suggestion.title}
            </h4>
            {showCompanyInfo && suggestion.companies && (
              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <Building2 className="w-3 h-3" />
                <span>{suggestion.companies.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Urgency & Confidence Badge */}
        <div className="flex flex-col gap-1 items-end">
          <Badge variant="outline" className={cn('text-xs', config.bgColor, config.color)}>
            {config.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-3 h-3" />
            <span>{confidencePercentage}%</span>
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      {!compact && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {suggestion.reasoning}
          </p>
        </div>
      )}

      {/* Deadline */}
      {suggestion.recommended_deadline && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            Recommended:{' '}
            {formatDistanceToNow(new Date(suggestion.recommended_deadline), { addSuffix: true })}
          </span>
          <Calendar className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          <span className="text-gray-600 dark:text-gray-400">
            {format(new Date(suggestion.recommended_deadline), 'MMM d, h:mm a')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700/50">
        <Button
          size="sm"
          variant="default"
          onClick={handleAccept}
          disabled={isAccepting || isDismissing}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          {isAccepting ? 'Creating...' : 'Create Task'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onEditAndAccept}
          disabled={isAccepting || isDismissing}
          className="border-gray-300 dark:border-gray-600"
        >
          <Edit className="w-3.5 h-3.5" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          disabled={isAccepting || isDismissing}
          className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}

export default NextActionCard
