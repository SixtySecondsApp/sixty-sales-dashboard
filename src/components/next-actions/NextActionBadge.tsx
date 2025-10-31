/**
 * NextActionBadge Component
 *
 * Compact visual indicator showing count of pending AI suggestions
 * Used on cards to indicate available next-action suggestions
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NextActionBadgeProps {
  count: number
  urgency?: 'high' | 'medium' | 'low'
  className?: string
  onClick?: () => void
  showIcon?: boolean
  compact?: boolean
}

export const NextActionBadge: React.FC<NextActionBadgeProps> = ({
  count,
  urgency = 'medium',
  className,
  onClick,
  showIcon = true,
  compact = false,
}) => {
  if (count === 0) return null

  const urgencyStyles = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
    medium: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  }

  const Icon = urgency === 'high' ? AlertCircle : urgency === 'medium' ? Zap : Sparkles

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200',
        'text-xs font-semibold backdrop-blur-sm cursor-pointer',
        urgencyStyles[urgency],
        compact && 'px-2 py-0.5',
        className
      )}
      title={`${count} AI ${count === 1 ? 'suggestion' : 'suggestions'} (${urgency} priority)`}
    >
      {showIcon && <Icon className={cn('w-3.5 h-3.5', compact && 'w-3 h-3')} />}
      <span>{count}</span>
      {!compact && <span>AI</span>}
    </motion.button>
  )
}

export default NextActionBadge
