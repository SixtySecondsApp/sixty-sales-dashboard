/**
 * RiskBadge Component
 *
 * Displays deal risk level with visual indicators:
 * - Low risk: No badge shown (or subtle indicator)
 * - Medium risk: Yellow warning badge
 * - High risk: Orange alert badge
 * - Critical risk: Red pulsing badge with factors tooltip
 */

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  riskFactors?: string[];
  /** Show even for low risk */
  showLowRisk?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show tooltip with risk factors on hover */
  interactive?: boolean;
  className?: string;
}

/**
 * Format risk factor string for display
 */
function formatRiskFactor(factor: string): string {
  return factor
    .replace(/_/g, ' ')
    .replace(/critical$/, '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Main Risk Badge Component
 */
export function RiskBadge({
  riskLevel,
  riskFactors = [],
  showLowRisk = false,
  compact = false,
  interactive = true,
  className = '',
}: RiskBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't show for low risk unless explicitly requested
  if (riskLevel === 'low' && !showLowRisk) {
    return null;
  }

  const config = {
    low: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
      icon: null,
      label: 'Low Risk',
      pulse: false,
    },
    medium: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-700',
      icon: AlertTriangle,
      label: 'At Risk',
      pulse: false,
    },
    high: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-700',
      icon: AlertTriangle,
      label: 'High Risk',
      pulse: false,
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-700',
      icon: AlertCircle,
      label: 'Critical',
      pulse: true,
    },
  };

  const { bg, text, border, icon: Icon, label, pulse } = config[riskLevel];

  if (compact) {
    return (
      <div
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={() => interactive && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          className={`
            inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold
            ${bg} ${text} border ${border}
            ${pulse ? 'animate-pulse' : ''}
          `}
        >
          {Icon && <Icon className="w-2.5 h-2.5" />}
          {riskLevel === 'critical' && '!'}
        </span>

        {/* Compact Tooltip */}
        <AnimatePresence>
          {showTooltip && interactive && riskFactors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute z-50 top-full left-0 mt-1 w-48"
            >
              <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg p-2 shadow-lg">
                <div className="font-semibold mb-1">{label}</div>
                <ul className="space-y-0.5">
                  {riskFactors.map((factor) => (
                    <li key={factor} className="text-gray-300 dark:text-gray-400">
                      • {formatRiskFactor(factor)}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => interactive && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
          ${bg} ${text} border ${border}
          ${pulse ? 'animate-pulse' : ''}
          transition-all
        `}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
        {riskFactors.length > 0 && (
          <span className="text-[10px] opacity-70">({riskFactors.length})</span>
        )}
      </span>

      {/* Full Tooltip */}
      <AnimatePresence>
        {showTooltip && interactive && riskFactors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 top-full left-0 mt-2 w-64"
          >
            <RiskFactorsTooltip
              riskLevel={riskLevel}
              riskFactors={riskFactors}
              onClose={() => setShowTooltip(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Risk Factors Tooltip Content
 */
interface RiskFactorsTooltipProps {
  riskLevel: RiskLevel;
  riskFactors: string[];
  onClose: () => void;
}

function RiskFactorsTooltip({ riskLevel, riskFactors, onClose }: RiskFactorsTooltipProps) {
  const levelColors = {
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const factorDescriptions: Record<string, string> = {
    stage_stall: 'Deal has been in current stage for too long',
    sentiment_declining: 'Meeting sentiment is trending downward',
    no_recent_meetings: 'No meetings in the past 14+ days',
    low_engagement: 'Low activity and engagement levels',
    slow_response: 'Response times are slower than average',
    stalled_pipeline: 'No stage changes in 30+ days',
    negative_last_meeting: 'Last meeting had negative sentiment',
    missed_followups: 'Overdue action items without completion',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Risk Factors
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${levelColors[riskLevel]}`}>
            {riskLevel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Risk Factors List */}
      <div className="p-3 space-y-2">
        {riskFactors.map((factor) => (
          <div key={factor} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatRiskFactor(factor)}
              </div>
              {factorDescriptions[factor] && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {factorDescriptions[factor]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Risk Level Indicator (Minimal Version)
 * Just a colored dot for very compact displays
 */
export function RiskLevelDot({
  riskLevel,
  className = '',
}: {
  riskLevel: RiskLevel;
  className?: string;
}) {
  const colors = {
    low: 'bg-gray-400',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <span
      className={`
        inline-block w-2 h-2 rounded-full
        ${colors[riskLevel]}
        ${riskLevel === 'critical' ? 'animate-pulse' : ''}
        ${className}
      `}
      title={`${riskLevel} risk`}
    />
  );
}

export default RiskBadge;
